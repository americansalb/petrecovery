import { redirect } from 'next/navigation';

/**
 * /pets/[id] has no page of its own. Today is where a caregiver acts,
 * so the pet's root lands there; the profile facts that used to live
 * on an Overview page are part of the Health record now.
 */
export default function PetPage({ params }) {
  redirect(`/pets/${params.id}/today`);
}
