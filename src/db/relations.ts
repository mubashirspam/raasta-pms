import { relations } from 'drizzle-orm';
import {
  teamMembers,
  employeeCategories,
  positions,
  weeklyTargets,
  operationalWeeks,
  dailyLogs,
  developerVisits,
  creatorDailyMetrics,
  creatorShootParticipants,
  viralVideoRecords,
  leadDistributions,
  instagramVideoRecords,
  extraWorkRecords,
  correctionRequests,
  notifications,
} from './schema';

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  category: one(employeeCategories, {
    fields: [teamMembers.categoryId],
    references: [employeeCategories.id],
  }),
  position: one(positions, {
    fields: [teamMembers.positionId],
    references: [positions.id],
  }),
  weeklyTargets: many(weeklyTargets),
  dailyLogs: many(dailyLogs),
  correctionRequests: many(correctionRequests),
  notifications: many(notifications),
}));

export const employeeCategoriesRelations = relations(employeeCategories, ({ many }) => ({
  members: many(teamMembers),
}));

export const positionsRelations = relations(positions, ({ many }) => ({
  members: many(teamMembers),
}));

export const weeklyTargetsRelations = relations(weeklyTargets, ({ one }) => ({
  member: one(teamMembers, {
    fields: [weeklyTargets.memberId],
    references: [teamMembers.id],
  }),
  week: one(operationalWeeks, {
    fields: [weeklyTargets.weekId],
    references: [operationalWeeks.id],
  }),
  position: one(positions, {
    fields: [weeklyTargets.positionId],
    references: [positions.id],
  }),
}));

export const operationalWeeksRelations = relations(operationalWeeks, ({ many }) => ({
  targets: many(weeklyTargets),
}));

export const dailyLogsRelations = relations(dailyLogs, ({ one, many }) => ({
  member: one(teamMembers, {
    fields: [dailyLogs.memberId],
    references: [teamMembers.id],
  }),
  developerVisits: many(developerVisits),
  creatorDailyMetrics: one(creatorDailyMetrics, {
    fields: [dailyLogs.id],
    references: [creatorDailyMetrics.logId],
  }),
  shootParticipants: many(creatorShootParticipants),
  viralVideoRecords: many(viralVideoRecords),
  leadDistributions: many(leadDistributions),
  instagramVideoRecords: many(instagramVideoRecords),
  extraWorkRecords: many(extraWorkRecords),
}));

export const developerVisitsRelations = relations(developerVisits, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [developerVisits.logId],
    references: [dailyLogs.id],
  }),
}));

export const creatorDailyMetricsRelations = relations(creatorDailyMetrics, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [creatorDailyMetrics.logId],
    references: [dailyLogs.id],
  }),
}));

export const creatorShootParticipantsRelations = relations(creatorShootParticipants, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [creatorShootParticipants.logId],
    references: [dailyLogs.id],
  }),
  member: one(teamMembers, {
    fields: [creatorShootParticipants.memberId],
    references: [teamMembers.id],
  }),
}));

export const viralVideoRecordsRelations = relations(viralVideoRecords, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [viralVideoRecords.logId],
    references: [dailyLogs.id],
  }),
  contentOwner: one(teamMembers, {
    fields: [viralVideoRecords.contentOwnerId],
    references: [teamMembers.id],
  }),
}));

export const leadDistributionsRelations = relations(leadDistributions, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [leadDistributions.logId],
    references: [dailyLogs.id],
  }),
  recipient: one(teamMembers, {
    fields: [leadDistributions.recipientId],
    references: [teamMembers.id],
  }),
}));

export const instagramVideoRecordsRelations = relations(instagramVideoRecords, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [instagramVideoRecords.logId],
    references: [dailyLogs.id],
  }),
}));

export const extraWorkRecordsRelations = relations(extraWorkRecords, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [extraWorkRecords.logId],
    references: [dailyLogs.id],
  }),
}));

export const correctionRequestsRelations = relations(correctionRequests, ({ one }) => ({
  member: one(teamMembers, {
    fields: [correctionRequests.memberId],
    references: [teamMembers.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  member: one(teamMembers, {
    fields: [notifications.memberId],
    references: [teamMembers.id],
  }),
}));
