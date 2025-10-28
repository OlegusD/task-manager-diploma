import React, { useMemo, useState } from 'react'
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    DragOverlay,
    useDroppable,
} from '@dnd-kit/core'
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
    Box,
    Stack,
    Typography,
    Card,
    CardContent,
    Button,
    TextField,
    Divider,
} from '@mui/material'

/**
 * Канбан-доска (JS, локальные данные)
 * Исправлено:
 *  - Реальные droppable-колонки через useDroppable (раньше не срабатывало onDragOver)
 *  - Перетаскивание между колонками и сортировка внутри колонки
 */

function TaskCard({ task, listeners, attributes, isDragging }) {
    return (
        <Card
            variant="outlined"
            elevation={isDragging ? 6 : 0}
            sx={{ mb: 1, cursor: 'grab', opacity: isDragging ? 0.9 : 1 }}
            {...attributes}
            {...listeners}
        >
            <CardContent sx={{ p: 1.25 }}>
                <Typography variant="body2" fontWeight={600}>
                    {task.title}
                </Typography>
                {task.description ? (
                    <Typography variant="caption" color="text.secondary">
                        {task.description}
                    </Typography>
                ) : null}
            </CardContent>
        </Card>
    )
}

function SortableTask({ task, colId }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        data: { type: 'task', colId, task },
    })
    const style = { transform: CSS.Transform.toString(transform), transition }
    return (
        <Box ref={setNodeRef} style={style}>
            <TaskCard
                task={task}
                attributes={attributes}
                listeners={listeners}
                isDragging={isDragging}
            />
        </Box>
    )
}

function DroppableColumn({ column, children }) {
    // Регистрируем ДРОП-зону колонки
    const { setNodeRef, isOver } = useDroppable({
        id: `col-${column.id}`,
        data: { type: 'column', colId: column.id },
    })
    return (
        <Box
            ref={setNodeRef}
            sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: isOver ? 'action.hover' : 'background.paper',
                minHeight: 40,
            }}
        >
            {children}
        </Box>
    )
}

export default function Dashboard() {
    const [columns] = useState([
        { id: 1, name: 'To Do', position: 1 },
        { id: 2, name: 'In Progress', position: 2 },
        { id: 3, name: 'Review', position: 3 },
        { id: 4, name: 'BugFix', position: 4 },
        { id: 5, name: 'Done', position: 5 },
    ])

    const [tasks, setTasks] = useState([
        { id: 't1', title: 'Настроить проект', description: 'Vite + MUI', statusId: 1, order: 0 },
        { id: 't2', title: 'Сделать канбан', description: '@dnd-kit', statusId: 1, order: 1 },
        { id: 't3', title: 'Подключить бэкенд', description: 'Express API', statusId: 2, order: 0 },
        { id: 't4', title: 'Добавить авторизацию', description: 'JWT', statusId: 2, order: 1 },
        { id: 't5', title: 'Сделать деплой', description: '', statusId: 3, order: 0 },
    ])

    const [activeId, setActiveId] = useState(null)
    const [draft, setDraft] = useState('')
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const tasksByCol = useMemo(() => {
        const map = new Map()
        columns.forEach((c) => map.set(c.id, []))
        tasks.forEach((t) => {
            if (!map.has(t.statusId)) map.set(t.statusId, [])
            map.get(t.statusId).push(t)
        })
        for (const [, arr] of map) arr.sort((a, b) => a.order - b.order)
        return map
    }, [tasks, columns])

    function normalizeOrders(inColId) {
        setTasks((prev) => {
            const inCol = prev
                .filter((x) => x.statusId === inColId)
                .sort((a, b) => a.order - b.order)
                .map((t, i) => ({ ...t, order: i }))
            const rest = prev.filter((x) => x.statusId !== inColId)
            return [...rest, ...inCol]
        })
    }

    function moveWithinColumn(colId, activeTaskId, overTaskId) {
        const colTasks = (tasksByCol.get(colId) || []).slice()
        const oldIndex = colTasks.findIndex((t) => t.id === activeTaskId)
        const newIndex = colTasks.findIndex((t) => t.id === overTaskId)
        if (oldIndex === -1 || newIndex === -1) return
        const reordered = arrayMove(colTasks, oldIndex, newIndex).map((t, idx) => ({
            ...t,
            order: idx,
        }))
        setTasks((prev) => {
            const rest = prev.filter((t) => t.statusId !== colId)
            return [...rest, ...reordered]
        })
    }

    function moveToColumn(taskId, targetColId, targetIndex = 0) {
        setTasks((prev) => {
            const t = prev.find((x) => x.id === taskId)
            if (!t) return prev
            const fromColId = t.statusId
            if (fromColId === targetColId) return prev

            // Сдвигаем order в целевой колонке
            const targetColTasks = prev
                .filter((x) => x.statusId === targetColId)
                .sort((a, b) => a.order - b.order)
            const updated = prev
                .map((x) =>
                    x.id === taskId ? { ...x, statusId: targetColId, order: targetIndex } : x
                )
                .map((x) =>
                    x.statusId === targetColId && x.id !== taskId && x.order >= targetIndex
                        ? { ...x, order: x.order + 1 }
                        : x
                )

            // Нормализация в обеих колонках
            const norm = (arr) => arr.map((t, i) => ({ ...t, order: i }))
            const target = norm(
                updated.filter((x) => x.statusId === targetColId).sort((a, b) => a.order - b.order)
            )
            const from = norm(
                updated.filter((x) => x.statusId === fromColId).sort((a, b) => a.order - b.order)
            )
            const rest = updated.filter(
                (x) => x.statusId !== targetColId && x.statusId !== fromColId
            )
            return [...rest, ...target, ...from]
        })
    }

    const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                Task Manager — Канбан (локальные данные)
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                {/* Быстрое добавление в первую колонку */}
                <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Быстрое добавление
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="Название задачи"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                        <Button
                            variant="contained"
                            onClick={() => {
                                if (!draft.trim()) return
                                const colId = columns[0].id
                                const nextOrder = (tasksByCol.get(colId) || []).length
                                const id = `t${Date.now()}`
                                setTasks((prev) => [
                                    ...prev,
                                    {
                                        id,
                                        title: draft.trim(),
                                        description: '',
                                        statusId: colId,
                                        order: nextOrder,
                                    },
                                ])
                                setDraft('')
                            }}
                        >
                            Добавить
                        </Button>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" color="text.secondary">
                        Перетаскивай карточки между колонками и внутри колонок.
                    </Typography>
                </Box>

                {/* Колонки */}
                <Box sx={{ overflowX: 'auto', width: '100%' }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={(e) => setActiveId(String(e.active.id))}
                        onDragOver={(e) => {
                            const { active, over } = e
                            if (!over) return
                            const overData = over.data?.current
                            if (!overData) return

                            // Перемещение между колонками во время drag (мгновенная реакция)
                            if (overData.type === 'column') {
                                moveToColumn(String(active.id), overData.colId, 0)
                            } else if (overData.type === 'task') {
                                const targetCol = overData.colId
                                const targetTaskId = over.id
                                const colTasks = tasksByCol.get(targetCol) || []
                                const idx = colTasks.findIndex((t) => t.id === targetTaskId)
                                moveToColumn(String(active.id), targetCol, Math.max(0, idx))
                            }
                        }}
                        onDragEnd={(e) => {
                            setActiveId(null)
                            const { active, over } = e
                            if (!over) return
                            const overData = over.data?.current
                            const activeData = e.active.data?.current
                            if (!overData || !activeData) return

                            // Если отпустили над задачей в той же колонке — пересортируем
                            if (
                                overData.type === 'task' &&
                                activeData.type === 'task' &&
                                overData.colId === activeData.colId
                            ) {
                                moveWithinColumn(overData.colId, String(active.id), String(over.id))
                            } else {
                                // Нормализация порядков на всякий случай
                                normalizeOrders(
                                    overData.type === 'task' ? overData.colId : overData.colId
                                )
                            }
                        }}
                    >
                        <Stack
                            direction="row"
                            spacing={2}
                            alignItems="flex-start"
                            sx={{ minWidth: 720 }}
                        >
                            {columns
                                .sort((a, b) => a.position - b.position)
                                .map((col) => {
                                    const colTasks = (tasksByCol.get(col.id) || []).slice()
                                    return (
                                        <Box key={col.id} sx={{ width: 320, flexShrink: 0 }}>
                                            <Typography
                                                variant="subtitle1"
                                                fontWeight={700}
                                                sx={{ mb: 1 }}
                                            >
                                                {col.name}
                                            </Typography>

                                            <SortableContext
                                                items={colTasks.map((t) => t.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <DroppableColumn column={col}>
                                                    {colTasks.map((t) => (
                                                        <SortableTask
                                                            key={t.id}
                                                            task={t}
                                                            colId={col.id}
                                                        />
                                                    ))}
                                                </DroppableColumn>
                                            </SortableContext>
                                        </Box>
                                    )
                                })}
                        </Stack>

                        <DragOverlay>
                            {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
                        </DragOverlay>
                    </DndContext>
                </Box>
            </Stack>
        </Box>
    )
}
