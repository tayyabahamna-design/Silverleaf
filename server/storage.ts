import { type TrainingWeek, type InsertTrainingWeek, type UpdateTrainingWeek } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getAllTrainingWeeks(): Promise<TrainingWeek[]>;
  getTrainingWeek(id: string): Promise<TrainingWeek | undefined>;
  createTrainingWeek(week: InsertTrainingWeek): Promise<TrainingWeek>;
  updateTrainingWeek(week: UpdateTrainingWeek): Promise<TrainingWeek | undefined>;
  deleteTrainingWeek(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private trainingWeeks: Map<string, TrainingWeek>;

  constructor() {
    this.trainingWeeks = new Map();
  }

  async getAllTrainingWeeks(): Promise<TrainingWeek[]> {
    return Array.from(this.trainingWeeks.values()).sort((a, b) => a.weekNumber - b.weekNumber);
  }

  async getTrainingWeek(id: string): Promise<TrainingWeek | undefined> {
    return this.trainingWeeks.get(id);
  }

  async createTrainingWeek(insertWeek: InsertTrainingWeek): Promise<TrainingWeek> {
    const id = randomUUID();
    const week: TrainingWeek = {
      id,
      weekNumber: insertWeek.weekNumber,
      competencyFocus: insertWeek.competencyFocus ?? "",
      objective: insertWeek.objective ?? "",
      deck2024FileName: insertWeek.deck2024FileName ?? null,
      deck2024FileUrl: insertWeek.deck2024FileUrl ?? null,
      deck2024FileSize: insertWeek.deck2024FileSize ?? null,
      deck2025FileName: insertWeek.deck2025FileName ?? null,
      deck2025FileUrl: insertWeek.deck2025FileUrl ?? null,
      deck2025FileSize: insertWeek.deck2025FileSize ?? null,
    };
    this.trainingWeeks.set(id, week);
    return week;
  }

  async updateTrainingWeek(updateWeek: UpdateTrainingWeek): Promise<TrainingWeek | undefined> {
    const existing = this.trainingWeeks.get(updateWeek.id);
    if (!existing) return undefined;
    
    const updated: TrainingWeek = {
      ...existing,
      ...(updateWeek.weekNumber !== undefined && { weekNumber: updateWeek.weekNumber }),
      ...(updateWeek.competencyFocus !== undefined && { competencyFocus: updateWeek.competencyFocus }),
      ...(updateWeek.objective !== undefined && { objective: updateWeek.objective }),
      ...(updateWeek.deck2024FileName !== undefined && { deck2024FileName: updateWeek.deck2024FileName }),
      ...(updateWeek.deck2024FileUrl !== undefined && { deck2024FileUrl: updateWeek.deck2024FileUrl }),
      ...(updateWeek.deck2024FileSize !== undefined && { deck2024FileSize: updateWeek.deck2024FileSize }),
      ...(updateWeek.deck2025FileName !== undefined && { deck2025FileName: updateWeek.deck2025FileName }),
      ...(updateWeek.deck2025FileUrl !== undefined && { deck2025FileUrl: updateWeek.deck2025FileUrl }),
      ...(updateWeek.deck2025FileSize !== undefined && { deck2025FileSize: updateWeek.deck2025FileSize }),
    };
    this.trainingWeeks.set(updateWeek.id, updated);
    return updated;
  }

  async deleteTrainingWeek(id: string): Promise<boolean> {
    return this.trainingWeeks.delete(id);
  }
}

export const storage = new MemStorage();
