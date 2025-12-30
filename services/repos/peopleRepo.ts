import { getSupabaseClient } from '../supabaseClient';
import type { Person } from '../../types';

type PersonRow = {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  eth_address: string | null;
  solana_address: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
    ethAddress: row.eth_address,
    solanaAddress: row.solana_address,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface UpsertPersonInput {
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  ethAddress?: string | null;
  solanaAddress?: string | null;
}

export interface UpsertPersonResult {
  person: Person;
  wasCreated: boolean;
}

export const peopleRepo = {
  /**
   * Find a person by email (case-insensitive).
   */
  async findByEmail(email: string): Promise<Person | null> {
    const supabase = getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await supabase
      .from('people')
      .select('*')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapPerson(data as PersonRow);
  },

  /**
   * Find a person by ID.
   */
  async findById(id: string): Promise<Person | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapPerson(data as PersonRow);
  },

  /**
   * Upsert a person by email.
   * 
   * INVARIANT: Email is the identity key (case-insensitive).
   * - If a person with this email exists, update their details (merge non-null values).
   * - If no person exists, create a new one.
   * 
   * Returns the person and whether they were newly created.
   */
  async upsertByEmail(input: UpsertPersonInput): Promise<UpsertPersonResult> {
    const supabase = getSupabaseClient();
    const normalizedEmail = input.email.toLowerCase().trim();

    if (!normalizedEmail) {
      throw new Error('Email is required for person upsert');
    }

    // Check if person exists
    const existing = await this.findByEmail(normalizedEmail);

    if (existing) {
      // Update existing person with any new non-null values
      const updates: Record<string, unknown> = {};
      
      if (input.name !== undefined && input.name !== null && input.name !== existing.name) {
        updates.name = input.name;
      }
      if (input.firstName !== undefined && input.firstName !== null && input.firstName !== existing.firstName) {
        updates.first_name = input.firstName;
      }
      if (input.lastName !== undefined && input.lastName !== null && input.lastName !== existing.lastName) {
        updates.last_name = input.lastName;
      }
      if (input.phoneNumber !== undefined && input.phoneNumber !== null && input.phoneNumber !== existing.phoneNumber) {
        updates.phone_number = input.phoneNumber;
      }
      if (input.ethAddress !== undefined && input.ethAddress !== null && input.ethAddress !== existing.ethAddress) {
        updates.eth_address = input.ethAddress;
      }
      if (input.solanaAddress !== undefined && input.solanaAddress !== null && input.solanaAddress !== existing.solanaAddress) {
        updates.solana_address = input.solanaAddress;
      }

      if (Object.keys(updates).length === 0) {
        // No changes needed
        return { person: existing, wasCreated: false };
      }

      const { data, error } = await supabase
        .from('people')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      return { person: mapPerson(data as PersonRow), wasCreated: false };
    }

    // Create new person
    const insertData = {
      email: normalizedEmail,
      name: input.name ?? null,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      phone_number: input.phoneNumber ?? null,
      eth_address: input.ethAddress ?? null,
      solana_address: input.solanaAddress ?? null
    };

    const { data, error } = await supabase
      .from('people')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      // Handle race condition: another request may have created the person
      const isUniqueViolation =
        (error as { code?: string })?.code === '23505' ||
        String(error.message ?? '').toLowerCase().includes('duplicate');

      if (isUniqueViolation) {
        const retryPerson = await this.findByEmail(normalizedEmail);
        if (retryPerson) {
          return { person: retryPerson, wasCreated: false };
        }
      }
      throw error;
    }

    return { person: mapPerson(data as PersonRow), wasCreated: true };
  },

  /**
   * Batch upsert multiple people.
   * Returns map of email -> UpsertPersonResult.
   */
  async batchUpsertByEmail(inputs: UpsertPersonInput[]): Promise<Map<string, UpsertPersonResult>> {
    const results = new Map<string, UpsertPersonResult>();

    // Process sequentially to avoid race conditions on same email
    for (const input of inputs) {
      const normalizedEmail = input.email.toLowerCase().trim();
      if (!normalizedEmail) continue;

      // Skip if we already processed this email in this batch
      if (results.has(normalizedEmail)) continue;

      const result = await this.upsertByEmail(input);
      results.set(normalizedEmail, result);
    }

    return results;
  },

  /**
   * List all people who have attended a specific field event.
   */
  async listByFieldEventId(fieldEventId: string): Promise<Person[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select('person_id, people(*)')
      .eq('field_event_id', fieldEventId);

    if (error) throw error;
    if (!data) return [];

    // Supabase returns people as a single object (not array) for many-to-one joins
    type JoinRow = { person_id: string; people: PersonRow | null };
    const rows = data as unknown as JoinRow[];
    return rows
      .filter((row): row is JoinRow & { people: PersonRow } => row.people !== null)
      .map((row) => mapPerson(row.people));
  },

  /**
   * Count how many field events a person has attended.
   */
  async getAttendanceCount(personId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('field_event_attendance')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId);

    if (error) throw error;
    return count ?? 0;
  }
};
