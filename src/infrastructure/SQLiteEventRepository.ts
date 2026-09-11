import {EventRepository} from '../application/EventRepository';
import {Event} from '../domain/Event';
import {getDatabase} from './Database';

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  occurredAt: number;
}

const SELECT_EVENTS = 'SELECT id, name, description, occurredAt FROM events ORDER BY occurredAt DESC';

function toEvent(row: EventRow): Event {
  return new Event(row.id, row.name, new Date(row.occurredAt), row.description);
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

    const rows = await db.getAllAsync<EventRow>(SELECT_EVENTS);

    return rows.map(toEvent);
  }

  async findRecent(limit: number): Promise<Event[]> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<EventRow>(`${SELECT_EVENTS} LIMIT ?`, [limit]);

    return rows.map(toEvent);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();

    await db.runAsync('DELETE FROM events WHERE id = ?', [id]);
  }
}
