/**
 * Append-only audit journal for medication data.
 *
 * Every mutation to PetMedication / MedicationDose calls audit() INSIDE the
 * same prisma transaction as the change, so the journal entry and the change
 * commit or roll back together. The journal has no foreign keys: it survives
 * anything that happens to the rows it describes, and is the recovery source
 * of truth if primary rows are ever damaged.
 */

/**
 * @param tx     prisma transaction client (or prisma itself outside a tx)
 * @param entry  { petId, medicationId?, doseId?, action, actorUserId?, snapshot }
 */
export function audit(tx, { petId, medicationId = null, doseId = null, action, actorUserId = null, snapshot }) {
  return tx.medicationAuditLog.create({
    data: {
      petId,
      medicationId,
      doseId,
      action,
      actorUserId,
      snapshot: JSON.stringify(snapshot ?? {}),
    },
  });
}

export const AUDIT_ACTIONS = {
  MED_CREATED: 'MED_CREATED',
  MED_UPDATED: 'MED_UPDATED',
  MED_DELETED: 'MED_DELETED',
  DOSE_LOGGED: 'DOSE_LOGGED',
  DOSE_CHANGED: 'DOSE_CHANGED',
  DOSE_VOIDED: 'DOSE_VOIDED',
};
