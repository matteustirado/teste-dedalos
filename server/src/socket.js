let io;

export const initIO = (serverIo) => {
    io = serverIo;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io não foi inicializado ainda!");
    }
    return io;
};