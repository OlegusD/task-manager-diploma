let io

function setIo(instance) {
    io = instance
}

function emitTaskStatusChange(payload) {
    if (io) io.emit('task_status_changed', payload)
}

module.exports = { setIo, emitTaskStatusChange }
