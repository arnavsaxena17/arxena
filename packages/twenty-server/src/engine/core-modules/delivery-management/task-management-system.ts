import * as deliveryManagementTypes from './types/delivery-management.types';

export class TaskManagementSystem {
    private tasks: Map<string, deliveryManagementTypes.Task[]>;

    constructor() {
        this.tasks = new Map();
    }

    addTask(entityId: string, task: deliveryManagementTypes.Task): void {
        if (!this.tasks.has(entityId)) {
            this.tasks.set(entityId, []);
        }
        this.tasks.get(entityId)?.push(task);
    }

    getTasks(entityId: string): deliveryManagementTypes.Task[] {
        return this.tasks.get(entityId) || [];
    }

    updateTaskStatus(entityId: string, taskId: string, status: deliveryManagementTypes.TaskStatus): void {
        const entityTasks = this.tasks.get(entityId);
        if (!entityTasks) throw new Error('Entity not found');

        const task = entityTasks.find(task => task.id === taskId);
        if (!task) throw new Error('Task not found');

        task.status = status;
    }
}
