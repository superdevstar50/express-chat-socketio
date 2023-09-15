import { data } from "./store.js";

export const killAfterXMinutes = (minute, roomId) => {
  const timerId = setTimeout(() => {
    const room = findRoom(roomId);

    room.users.forEach((user) => {
      user.emit("timeExpired");
    });

    room.closed = true;
  }, minute * 60 * 1000);

  return timerId;
};

export const findRoom = (roomId) => {
  return data.rooms
    .filter((room) => !room.closed)
    .filter((room) => room.id === roomId)[0];
};
