import mongoose from "mongoose";

export const AnalyticsEventType = {
  PAGE_VIEW: "page_view",
  FEATURE_USAGE: "feature_usage",
};

const analyticsEventSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    identityKey: { type: String, required: true, index: true },
    eventType: {
      type: String,
      enum: Object.values(AnalyticsEventType),
      required: true,
      index: true,
    },
    feature: { type: String, default: null, index: true },
    path: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ occurredAt: 1, eventType: 1 });
analyticsEventSchema.index({ eventType: 1, feature: 1, occurredAt: 1 });
analyticsEventSchema.index({ occurredAt: 1, identityKey: 1 });

const visitorSessionSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, default: null, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    lastPath: { type: String, default: null },
  },
  { timestamps: true },
);

const analyticsMonthlyAggregateSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true, index: true },
    monthStart: { type: Date, required: true, index: true },
    monthEnd: { type: Date, required: true },
    visits: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    smartSearchUses: { type: Number, default: 0 },
    hybridSearchUses: { type: Number, default: 0 },
    source: { type: String, default: "raw-events" },
  },
  { timestamps: true },
);

export const AnalyticsEventModel = mongoose.model("AnalyticsEvent", analyticsEventSchema, "analytics_events");
export const VisitorSessionModel = mongoose.model("VisitorSession", visitorSessionSchema, "visitor_sessions");
export const AnalyticsMonthlyAggregateModel = mongoose.model("AnalyticsMonthlyAggregate", analyticsMonthlyAggregateSchema, "analytics_monthly_aggregates");
