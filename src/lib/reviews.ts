import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type Review = {
  id: string;
  profileId: string;
  score: number;
  comment: string;
  createdAt: string;
};

type Row = {
  id: string;
  profile_id: string;
  score: number;
  comment: string;
  created_at: string;
};

function toReview(row: Row): Review {
  return {
    id: row.id,
    profileId: row.profile_id,
    score: Number(row.score),
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export const listStallReviews = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ profileId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select id, profile_id, score, comment, created_at
      from reviews
      where profile_id = ${data.profileId}
      order by created_at desc
      limit 40
    `;
    return rows.map(toReview);
  });

export const listMyReviewedIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ profile_id: string }>`
      select profile_id from reviews where user_id = ${context.userId}
    `;
    return rows.map((r) => r.profile_id);
  });

const Upsert = z.object({
  profileId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(120).default(""),
});

export const upsertReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => Upsert.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const used = await sql<{ n: number }>`
      select count(*)::int as n
      from inquiries
      where user_id = ${context.userId}
        and profile_id = ${data.profileId}
        and coalesce(status, 'pending') = 'used'
    `;
    if (Number(used[0]?.n ?? 0) < 1) throw new Error("用完公厕才能评");
    const existing = await sql<{ id: string }>`
      select id from reviews
      where user_id = ${context.userId} and profile_id = ${data.profileId}
      limit 1
    `;
    if (existing[0]) {
      await sql`
        update reviews
        set score = ${data.score}, comment = ${data.comment}, updated_at = now()
        where id = ${existing[0].id}
      `;
      return { id: existing[0].id };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into reviews (id, user_id, profile_id, score, comment)
      values (${id}, ${context.userId}, ${data.profileId}, ${data.score}, ${data.comment})
    `;
    return { id };
  });
