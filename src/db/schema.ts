import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
  json,
  varchar,
  decimal,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Admin Settings (singleton row) ───────────────────────────────────────────
export const adminSettings = pgTable(
  'admin_settings',
  {
    id: integer('id').primaryKey().default(1),
    pinHash: text('pin_hash'),
    pinSet: boolean('pin_set').notNull().default(false),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Dubai'),
    targetDeadlineDay: integer('target_deadline_day').notNull().default(1),
    logDeadlineHour: integer('log_deadline_hour').notNull().default(22),
    sundayWorkEnabled: boolean('sunday_work_enabled').notNull().default(false),
    instagramVideoStatuses: text('instagram_video_statuses')
      .notNull()
      .default('Shooting,Editing,Posted,Scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);


// ─── Employee Categories ───────────────────────────────────────────────────────
export const employeeCategories = pgTable('employee_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayOrder: integer('display_order').notNull().default(0),
});

// ─── Positions ─────────────────────────────────────────────────────────────────
export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  // Positions belong to one category: Sales Agent has Agent/LER/BDM,
  // Content Creator has Senior/Junior.
  categoryId: integer('category_id')
    .notNull()
    .references(() => employeeCategories.id, { onDelete: 'restrict' }),
  displayOrder: integer('display_order').notNull().default(0),
});

// ─── App Users (login) ─────────────────────────────────────────────────────────
// One row per person who can log in. Admins have no team-member row; every
// regular user is linked to exactly one. PINs are stored in plain text so the
// admin can read them back — an explicit product decision for this internal app.
export const appUsers = pgTable(
  'app_users',
  {
    id: text('id').primaryKey(),
    username: varchar('username', { length: 60 }).notNull(),
    pin: varchar('pin', { length: 4 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('user'),
    memberId: text('member_id').references(() => teamMembers.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameUniq: uniqueIndex('app_users_username_uniq').on(t.username),
    // One login per team member; admins (null member_id) are exempt.
    memberUniq: uniqueIndex('app_users_member_uniq')
      .on(t.memberId)
      .where(sql`${t.memberId} is not null`),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

// ─── Team Members ──────────────────────────────────────────────────────────────
export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey(),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    memberCode: varchar('member_code', { length: 20 }).notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => employeeCategories.id, { onDelete: 'restrict' }),
    positionId: integer('position_id')
      .notNull()
      .references(() => positions.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    lastSubmissionAt: timestamp('last_submission_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    memberCodeUniq: uniqueIndex('team_members_member_code_uniq').on(t.memberCode),
    categoryIdx: index('team_members_category_idx').on(t.categoryId),
    activeIdx: index('team_members_active_idx').on(t.isActive),
  }),
);

// ─── Operational Weeks ─────────────────────────────────────────────────────────
export const operationalWeeks = pgTable(
  'operational_weeks',
  {
    id: serial('id').primaryKey(),
    weekNumber: integer('week_number').notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    label: varchar('label', { length: 50 }).notNull(),
  },
  (t) => ({
    startDateUniq: uniqueIndex('operational_weeks_start_date_uniq').on(t.startDate),
    monthYearIdx: index('operational_weeks_month_year_idx').on(t.month, t.year),
  }),
);

// ─── Creator Team ──────────────────────────────────────────────────────────────
// A content creator's roster of sales agents. The creator manages this on the
// Targets page and it pre-fills their weekly target form.
export const creatorTeamAgents = pgTable(
  'creator_team_agents',
  {
    id: serial('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    creatorAgentUniq: uniqueIndex('creator_team_agents_creator_agent_uniq').on(
      t.creatorId,
      t.agentId,
    ),
    creatorIdx: index('creator_team_agents_creator_idx').on(t.creatorId),
  }),
);

// ─── Weekly Targets ────────────────────────────────────────────────────────────
export const weeklyTargets = pgTable(
  'weekly_targets',
  {
    id: serial('id').primaryKey(),
    memberId: text('member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'restrict' }),
    weekId: integer('week_id')
      .notNull()
      .references(() => operationalWeeks.id, { onDelete: 'restrict' }),
    // Creator targets are set per agent on the creator's team: one row per
    // creator + week + agent. Sales targets leave this null.
    agentId: text('agent_id').references(() => teamMembers.id, { onDelete: 'cascade' }),
    // Sales fields
    connectedCallsTarget: integer('connected_calls_target'),
    videoCallsTarget: integer('video_calls_target'),
    faceToFaceTarget: integer('face_to_face_target'),
    revenueTarget: decimal('revenue_target', { precision: 14, scale: 2 }),
    // Creator fields
    reelsTarget: integer('reels_target'),
    viralVideosTarget: integer('viral_videos_target'),
    leadsTarget: integer('leads_target'),
    picsTarget: integer('pics_target'),
    teamVideosTarget: integer('team_videos_target'),
    // Position / status
    positionId: integer('position_id').references(() => positions.id),
    positionFlagged: boolean('position_flagged').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('submitted'),
    referenceNumber: varchar('reference_number', { length: 30 }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Postgres treats NULLs as distinct, so a plain composite unique would let
    // duplicate sales rows through. Two partial indexes instead.
    memberWeekUniq: uniqueIndex('weekly_targets_member_week_uniq')
      .on(t.memberId, t.weekId)
      .where(sql`${t.agentId} is null`),
    memberWeekAgentUniq: uniqueIndex('weekly_targets_member_week_agent_uniq')
      .on(t.memberId, t.weekId, t.agentId)
      .where(sql`${t.agentId} is not null`),
    memberIdx: index('weekly_targets_member_idx').on(t.memberId),
    weekIdx: index('weekly_targets_week_idx').on(t.weekId),
    agentIdx: index('weekly_targets_agent_idx').on(t.agentId),
  }),
);

// ─── Team Revenue Targets (LER/BDM monthly) ────────────────────────────────────
export const teamRevenueTargets = pgTable(
  'team_revenue_targets',
  {
    id: serial('id').primaryKey(),
    memberId: text('member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'restrict' }),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
    version: integer('version').notNull().default(1),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    proposedBy: text('proposed_by'),
    approvedBy: text('approved_by'),
    reason: text('reason'),
    previousAmount: decimal('previous_amount', { precision: 14, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    memberMonthYearIdx: index('team_rev_member_month_year_idx').on(t.memberId, t.month, t.year),
  }),
);

// ─── Daily Logs ────────────────────────────────────────────────────────────────
export const dailyLogs = pgTable(
  'daily_logs',
  {
    id: serial('id').primaryKey(),
    memberId: text('member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'restrict' }),
    logDate: date('log_date').notNull(),
    // 'present' | 'remote' | 'hybrid' | 'absent' — only 'absent' is a non-working day.
    attendance: varchar('attendance', { length: 20 }).notNull(),
    absenceNote: text('absence_note'),
    arrivalTiming: varchar('arrival_timing', { length: 30 }),
    lateReason: text('late_reason'),
    organicCalls: integer('organic_calls').notNull().default(0),
    marketingCalls: integer('marketing_calls').notNull().default(0),
    // Time spent on the phone, stored as whole minutes. The form collects
    // hours and minutes separately; organic and reassigned are tracked apart
    // because they are different kinds of work. No target is set against these.
    organicCallMinutes: integer('organic_call_minutes').notNull().default(0),
    marketingCallMinutes: integer('marketing_call_minutes').notNull().default(0),
    // computed in application layer: organic + marketing
    connectedCalls: integer('connected_calls').notNull().default(0),
    videoCalls: integer('video_calls').notNull().default(0),
    faceToFace: integer('face_to_face').notNull().default(0),
    reelsUploaded: integer('reels_uploaded').notNull().default(0),
    leadsReceived: integer('leads_received').notNull().default(0),
    salesRevenue: decimal('sales_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
    // LER/BDM also report revenue brought in by their team.
    teamRevenue: decimal('team_revenue', { precision: 14, scale: 2 }),
    learnedToday: varchar('learned_today', { length: 150 }),
    issuesToday: varchar('issues_today', { length: 250 }),
    status: varchar('status', { length: 20 }).notNull().default('submitted'),
    referenceNumber: varchar('reference_number', { length: 30 }).notNull(),
    backdated: boolean('backdated').notNull().default(false),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    memberDateUniq: uniqueIndex('daily_logs_member_date_uniq').on(t.memberId, t.logDate),
    memberIdx: index('daily_logs_member_idx').on(t.memberId),
    logDateIdx: index('daily_logs_log_date_idx').on(t.logDate),
  }),
);

// ─── Developer Visits ──────────────────────────────────────────────────────────
export const developerVisits = pgTable(
  'developer_visits',
  {
    id: serial('id').primaryKey(),
    logId: integer('log_id')
      .notNull()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    developerName: varchar('developer_name', { length: 200 }).notNull(),
  },
  (t) => ({
    logIdx: index('developer_visits_log_idx').on(t.logId),
  }),
);

// ─── Creator Daily Metrics ─────────────────────────────────────────────────────
export const creatorDailyMetrics = pgTable(
  'creator_daily_metrics',
  {
    id: serial('id').primaryKey(),
    logId: integer('log_id')
      .notNull()
      .unique()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    reelsGiven: integer('reels_given').notNull().default(0),
    viralVideos: integer('viral_videos').notNull().default(0),
    leadsGenerated: integer('leads_generated').notNull().default(0),
    picsGiven: integer('pics_given').notNull().default(0),
    instagramVideos: integer('instagram_videos').notNull().default(0),
    remarks: varchar('remarks', { length: 500 }),
  },
);

// ─── Creator Per-Agent Daily Metrics ───────────────────────────────────────────
// A creator logs Reels / Viral / Leads separately for each agent on their team.
// creator_daily_metrics keeps the roll-up totals for the day.
export const creatorAgentDailyMetrics = pgTable(
  'creator_agent_daily_metrics',
  {
    id: serial('id').primaryKey(),
    logId: integer('log_id')
      .notNull()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'cascade' }),
    reelsGiven: integer('reels_given').notNull().default(0),
    viralVideos: integer('viral_videos').notNull().default(0),
    leadsGenerated: integer('leads_generated').notNull().default(0),
    picsGiven: integer('pics_given').notNull().default(0),
  },
  (t) => ({
    logAgentUniq: uniqueIndex('creator_agent_daily_metrics_log_agent_uniq').on(t.logId, t.agentId),
    logIdx: index('creator_agent_daily_metrics_log_idx').on(t.logId),
  }),
);

// ─── Creator Shoot Participants ────────────────────────────────────────────────
export const creatorShootParticipants = pgTable(
  'creator_shoot_participants',
  {
    id: serial('id').primaryKey(),
    logId: integer('log_id')
      .notNull()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    logMemberUniq: uniqueIndex('creator_shoot_log_member_uniq').on(t.logId, t.memberId),
  }),
);

// ─── Viral Video Records ───────────────────────────────────────────────────────
export const VIRAL_PLATFORMS = [
  'YouTube',
  'Instagram',
  'TikTok',
  'Facebook',
  'LinkedIn',
] as const;

// Viral videos (100k+ views) counted per agent, per platform. An agent's viral
// total for the day is the sum of their platform counts.
export const viralPlatformCounts = pgTable(
  'viral_platform_counts',
  {
    id: serial('id').primaryKey(),
    logId: integer('log_id')
      .notNull()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 50 }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => ({
    logAgentPlatformUniq: uniqueIndex('viral_platform_counts_log_agent_platform_uniq').on(
      t.logId,
      t.agentId,
      t.platform,
    ),
    logIdx: index('viral_platform_counts_log_idx').on(t.logId),
  }),
);



// ─── Extra Work Records ────────────────────────────────────────────────────────
export const extraWorkRecords = pgTable(
  'extra_work_records',
  {
    id: serial('id').primaryKey(),
    logId: integer('log_id')
      .notNull()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    workType: varchar('work_type', { length: 100 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    explanation: text('explanation'),
    link: text('link'),
  },
  (t) => ({
    logIdx: index('extra_work_records_log_idx').on(t.logId),
  }),
);

// ─── Correction Requests ───────────────────────────────────────────────────────
export const correctionRequests = pgTable(
  'correction_requests',
  {
    id: serial('id').primaryKey(),
    recordType: varchar('record_type', { length: 20 }).notNull(), // 'target' | 'log'
    recordId: integer('record_id').notNull(),
    memberId: text('member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'restrict' }),
    proposedChanges: json('proposed_changes').notNull(),
    originalValues: json('original_values').notNull(),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    adminNote: text('admin_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
  },
  (t) => ({
    memberIdx: index('correction_requests_member_idx').on(t.memberId),
    statusIdx: index('correction_requests_status_idx').on(t.status),
  }),
);

// ─── Target Revision Requests ──────────────────────────────────────────────────
export const targetRevisionRequests = pgTable(
  'target_revision_requests',
  {
    id: serial('id').primaryKey(),
    targetId: integer('target_id')
      .notNull()
      .references(() => weeklyTargets.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'restrict' }),
    previousAmount: decimal('previous_amount', { precision: 14, scale: 2 }),
    proposedAmount: decimal('proposed_amount', { precision: 14, scale: 2 }),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

// ─── Working Day Exceptions ────────────────────────────────────────────────────
export const workingDayExceptions = pgTable(
  'working_day_exceptions',
  {
    id: serial('id').primaryKey(),
    exceptionDate: date('exception_date').notNull().unique(),
    type: varchar('type', { length: 20 }).notNull(), // 'holiday' | 'special_sunday'
    label: varchar('label', { length: 200 }),
  },
);

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    memberId: text('member_id').references(() => teamMembers.id, { onDelete: 'set null' }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    isReadIdx: index('notifications_is_read_idx').on(t.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(t.createdAt),
  }),
);

// ─── Audit Log ─────────────────────────────────────────────────────────────────
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: text('entity_id'),
    actor: varchar('actor', { length: 100 }).notNull().default('admin'),
    details: json('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('audit_log_entity_idx').on(t.entityType, t.entityId),
    createdAtIdx: index('audit_log_created_at_idx').on(t.createdAt),
  }),
);

// ─── Type exports ──────────────────────────────────────────────────────────────
export type AdminSettings = typeof adminSettings.$inferSelect;
export type EmployeeCategory = typeof employeeCategories.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type OperationalWeek = typeof operationalWeeks.$inferSelect;
export type WeeklyTarget = typeof weeklyTargets.$inferSelect;
export type NewWeeklyTarget = typeof weeklyTargets.$inferInsert;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;
export type CreatorDailyMetrics = typeof creatorDailyMetrics.$inferSelect;
export type CreatorAgentDailyMetrics = typeof creatorAgentDailyMetrics.$inferSelect;
export type ViralPlatformCount = typeof viralPlatformCounts.$inferSelect;
export type ExtraWorkRecord = typeof extraWorkRecords.$inferSelect;
export type CorrectionRequest = typeof correctionRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
