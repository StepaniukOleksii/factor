import {EventRepository} from '../application/EventRepository';
import {Event} from '../domain/Event';
import {getDatabase} from './Database';

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  occurredAt: number;
}

export class SQLiteEventRepository implements EventRepository {
  async save(event: Event): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      'INSERT INTO events (id, name, description, occurredAt) VALUES (?, ?, ?, ?)',
      [event.id, event.name, event.description, event.occurredAt.getTime()]
    );
  }

  async findAll(): Promise<Event[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<EventRow>(
      'SELECT id, name, description, occurredAt FROM events ORDER BY occurredAt DESC'
    );

    return rows.map(row => new Event(row.id, row.name, new Date(row.occurredAt), row.description));
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();

    await db.runAsync('DELETE FROM events WHERE id = ?', [id]);
  }
}
