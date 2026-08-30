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
  viralPlatformCounts,
  extraWorkRecords,
  correctionRequests,
  notifications,
  creatorTeamAgents,
  creatorAgentDailyMetrics,
  appUsers,
  sessions,
} from './schema';

export const appUsersRelations = relations(appUsers, ({ one, many }) => ({
  member: one(teamMembers, {
    fields: [appUsers.memberId],
    references: [teamMembers.id],
  }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(appUsers, {
    fields: [sessions.userId],
    references: [appUsers.id],
  }),
}));

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
  positions: many(positions),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  members: many(teamMembers),
  category: one(employeeCategories, {
    fields: [positions.categoryId],
    references: [employeeCategories.id],
  }),
}));

export const creatorAgentDailyMetricsRelations = relations(creatorAgentDailyMetrics, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [creatorAgentDailyMetrics.logId],
    references: [dailyLogs.id],
  }),
  agent: one(teamMembers, {
    fields: [creatorAgentDailyMetrics.agentId],
    references: [teamMembers.id],
    relationName: 'dailyMetricAgent',
  }),
}));

export const creatorTeamAgentsRelations = relations(creatorTeamAgents, ({ one }) => ({
  creator: one(teamMembers, {
    fields: [creatorTeamAgents.creatorId],
    references: [teamMembers.id],
    relationName: 'creatorTeam',
  }),
  agent: one(teamMembers, {
    fields: [creatorTeamAgents.agentId],
    references: [teamMembers.id],
    relationName: 'agentOfCreators',
  }),
}));

export const weeklyTargetsRelations = relations(weeklyTargets, ({ one }) => ({
  member: one(teamMembers, {
    fields: [weeklyTargets.memberId],
    references: [teamMembers.id],
  }),
  agent: one(teamMembers, {
    fields: [weeklyTargets.agentId],
    references: [teamMembers.id],
    relationName: 'targetAgent',
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
  creatorAgentMetrics: many(creatorAgentDailyMetrics),
  shootParticipants: many(creatorShootParticipants),
  viralPlatformCounts: many(viralPlatformCounts),
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

export const viralPlatformCountsRelations = relations(viralPlatformCounts, ({ one }) => ({
  log: one(dailyLogs, {
    fields: [viralPlatformCounts.logId],
    references: [dailyLogs.id],
  }),
  agent: one(teamMembers, {
    fields: [viralPlatformCounts.agentId],
    references: [teamMembers.id],
    relationName: 'viralAgent',
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
