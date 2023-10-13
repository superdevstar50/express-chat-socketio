import { Server } from "socket.io";

import { killAfterXMinutes, findRoom } from "./util.js";

const MESSAGE_TEXT = 0;
const MESSAGE_FILE = 1;

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
    userId: socket.name,
    msg: msg,
    type: MESSAGE_TEXT,
    time: new Date(),
  };

  room.history.push(message);

  room.users.forEach((user) => {
    user.emit("msg", message);

    if (socket.name !== user.name) user.emit("typing", "end");
  });

  setTimeout(() => {
    const otherName = "AI";
    room.users.forEach((user) => {
      const message = {
        userId: otherName,
        msg: "Dummy Response",
        type: MESSAGE_TEXT,
        time: new Date(),
      };

      room.history.push(message);

      user.emit("msg", message);
    });
  }, 1000);
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

  const message = {
    userId: socket.name,
    filename,
    type: MESSAGE_FILE,
    time: new Date(),
  };

  room.history.push(message);

  room.users.forEach((user) => {
    user.emit("msg", message);
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
