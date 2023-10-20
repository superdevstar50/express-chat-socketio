import { Server } from "socket.io";
import uuid4 from "uuid4";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";

import dotenv from "dotenv";
dotenv.config();

import { killAfterXMinutes, findRoom } from "./util.js";

const MESSAGE_TEXT = 0;
const MESSAGE_FILE = 1;

const AI_API_URL = process.env.AI_API_URL;

const initSocket = (socket) => {
  const roomId = socket.handshake.query.roomId;

  const room = findRoom(roomId);

  if (room === undefined) {
    socket.emit("roomNotFound");
    socket.disconnect();
    return;
  }

  if (room.users.length >= 2) {
    socket.emit("userFull");
    socket.disconnect();
    return;
  } else {
    socket.emit("enterYourName");
    socket.roomId = roomId;
    room.users.push(socket);
  }
};

const handleMsg = (socket) => (msg) => {
  const room = findRoom(socket.roomId);

  if (!room) return;

  clearTimeout(room.timerId);
  room.timerId = killAfterXMinutes(room.minute, room.id);
  room.lastdate = new Date();

  const message = {
    id: uuid4(),
    userId: socket.name,
    msg: msg,
    type: MESSAGE_TEXT,
    time: new Date(),
  };

  room.history.push(message);

  socket.emit("msg", message);

  //integrate ai
  axios
    .get(`${AI_API_URL}/ping`, { insecureHTTPParser: true })
    .then((res) => {
      socket.emit("2ticks", { id: message.id });

      axios
        .get(`${AI_API_URL}/getanswer?q=${message.msg}`, {
          insecureHTTPParser: true,
        })
        .then((res) => {
          const aiName = "AI";

          const message = {
            userId: aiName,
            msg: res.data.message,
            type: MESSAGE_TEXT,
            time: new Date(),
          };

          room.history.push(message);

          socket.emit("msg", message);
        });
    })
    .catch((err) => {
      console.log(err);
    });
};

const handleTyping = (socket) => (type) => {
  const room = findRoom(socket.roomId);

  if (!room) return;

  room.users.forEach((user) => {
    if (socket.name !== user.name) user.emit("typing", type);
  });
};

const handleFile = (socket) => (filename) => {
  const room = findRoom(socket.roomId);

  if (!room) return;

  clearTimeout(room.timerId);
  room.timerId = killAfterXMinutes(room.minute, room.id);
  room.lastdate = new Date();

  var newFile = fs.createReadStream(`./uploads/${filename}`);

  const form_data = new FormData();
  form_data.append("file", newFile);
  const request_config = {
    method: "post",
    url: `${AI_API_URL}/gettext`,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    data: form_data,
    insecureHTTPParser: true,
  };
  axios(request_config).then((res) => {
    const msgText = res.data.message;

    const message = {
      id: uuid4(),
      userId: socket.name,
      filename,
      type: MESSAGE_FILE,
      time: new Date(),
    };

    room.history.push(message);

    socket.emit("msg", message);

    axios
      .get(`${AI_API_URL}/ping`, { insecureHTTPParser: true })
      .then((res) => {
        socket.emit("2ticks", { id: message.id });

        axios
          .get(`${AI_API_URL}/getanswer?q=${msgText}`, {
            insecureHTTPParser: true,
          })
          .then((res) => {
            const aiName = "AI";

            const message = {
              userId: aiName,
              msg: res.data.message,
              type: MESSAGE_TEXT,
              time: new Date(),
            };

            room.history.push(message);

            socket.emit("msg", message);
          });
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

const handleSetName = (socket) => (name) => {
  const room = findRoom(socket.roomId);

  if (room.users.findIndex((user) => user.name === name) === -1) {
    socket.name = name;
    socket.emit("letsChat");

    const userList = room.users
      .filter((user) => user.name)
      .map((user) => user.name);

    room.users.forEach((user) => {
      user.emit("setUserList", userList);
    });
  } else {
    socket.emit("errSameName");
  }
};

const handleDisconnect = (socket) => () => {
  const room = findRoom(socket.roomId);

  if (!room) return;

  room.users = room.users.filter((user) => user.id !== socket.id);

  const userList = room.users
    .filter((user) => user.name)
    .map((user) => user.name);

  room.users.forEach((user) => {
    user.emit("setUserList", userList);
  });
};

export default (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    initSocket(socket);

    socket.on("msg", handleMsg(socket));

    socket.on("typing", handleTyping(socket));

    socket.on("sendFile", handleFile(socket));

    socket.on("setName", handleSetName(socket));

    socket.on("disconnect", handleDisconnect(socket));
  });
};
