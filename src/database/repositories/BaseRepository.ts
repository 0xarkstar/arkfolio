import { eq, SQL, and } from 'drizzle-orm';
import { SQLiteTable, TableConfig } from 'drizzle-orm/sqlite-core';
import { getDb, generateId } from '../init';
import { logger } from '../../utils/logger';

/**
 * Base repository providing common CRUD operations
 * All repositories extend this for consistent database access patterns
 */
export abstract class BaseRepository<
  TTable extends SQLiteTable<TableConfig>,
  TSelect,
  TInsert extends Record<string, unknown>
> {
  protected abstract readonly table: TTable;
  protected abstract readonly tableName: string;

  /**
   * Get database instance
   */
  protected getDb() {
    return getDb();
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return generateId();
  }

  /**
   * Find all records
   */
  async findAll(): Promise<TSelect[]> {
    try {
      const db = this.getDb();
      const results = await db.select().from(this.table);
      return results as TSelect[];
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to find all:`, error);
      throw error;
    }
  }

  /**
   * Find records with conditions
   */
  async findWhere(condition: SQL): Promise<TSelect[]> {
    try {
      const db = this.getDb();
      const results = await db.select().from(this.table).where(condition);
      return results as TSelect[];
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to find where:`, error);
      throw error;
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<TSelect | null> {
    try {
      const db = this.getDb();
      const idColumn = (this.table as unknown as { id: unknown }).id;
      const results = await db
        .select()
        .from(this.table)
        .where(eq(idColumn as SQL, id))
        .limit(1);
      return (results[0] as TSelect) || null;
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to find by ID:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: TInsert): Promise<TSelect> {
    try {
      const db = this.getDb();
      const id = (data as Record<string, unknown>).id || this.generateId();
      const record = { ...data, id };
      await db.insert(this.table).values(record);
      return record as unknown as TSelect;
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to create:`, error);
      throw error;
    }
  }

  /**
   * Create multiple records
   */
  async createMany(dataArray: TInsert[]): Promise<void> {
    try {
      const db = this.getDb();
      for (const data of dataArray) {
        const id = (data as Record<string, unknown>).id || this.generateId();
        await db.insert(this.table).values({ ...data, id });
      }
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to create many:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<TInsert>): Promise<void> {
    try {
      const db = this.getDb();
      const idColumn = (this.table as unknown as { id: unknown }).id;
      await db
        .update(this.table)
        .set(data as Record<string, unknown>)
        .where(eq(idColumn as SQL, id));
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to update:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const db = this.getDb();
      const idColumn = (this.table as unknown as { id: unknown }).id;
      await db.delete(this.table).where(eq(idColumn as SQL, id));
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to delete:`, error);
      throw error;
    }
  }

  /**
   * Delete records matching a condition
   */
  async deleteWhere(condition: SQL): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(this.table).where(condition);
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to delete where:`, error);
      throw error;
    }
  }

  /**
   * Delete all records
   */
  async deleteAll(): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(this.table);
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to delete all:`, error);
      throw error;
    }
  }

  /**
   * Count records
   */
  async count(): Promise<number> {
    try {
      const db = this.getDb();
      const results = await db.select().from(this.table);
      return results.length;
    } catch (error) {
      logger.error(`[${this.tableName}Repository] Failed to count:`, error);
      throw error;
    }
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }
}

/**
 * Helper to combine multiple conditions with AND
 */
export function combineConditions(...conditions: (SQL | undefined)[]): SQL | undefined {
  const validConditions = conditions.filter((c): c is SQL => c !== undefined);
  if (validConditions.length === 0) return undefined;
  if (validConditions.length === 1) return validConditions[0];
  return and(...validConditions);
}
