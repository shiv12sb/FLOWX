const prisma = require('../config/database');
const signalOptimization = require('./signalOptimizationService');
const { broadcastSignalUpdate } = require('../utils/signalRealtime');

async function listSignals() {
  return prisma.signal.findMany();
}

async function getSignal(id) {
  return prisma.signal.findUnique({ where: { id } });
}

async function createSignal(data) {
  const created = await prisma.signal.create({ data });
  return created;
}

async function updateSignal(id, patch) {
  const updated = await prisma.signal.update({ where: { id }, data: patch });
  return updated;
}

async function suggestOptimization(id, options = {}) {
  const signal = await getSignal(id);
  if (!signal) throw new Error('Signal not found');
  const suggestion = await signalOptimization.optimizeSignal(signal, options);
  // broadcast suggestion (decision-support only)
  try { broadcastSignalUpdate(id, { suggestion }); } catch (e) {}
  return suggestion;
}

async function emergencyPriority(id, direction) {
  const signal = await getSignal(id);
  if (!signal) throw new Error('Signal not found');
  const suggestion = await signalOptimization.optimizeSignal(signal, { mode: 'EMERGENCY_PRIORITY', emergencyDirection: direction });
  try { broadcastSignalUpdate(id, { suggestion, emergency: true }); } catch (e) {}
  // create an alert for operator attention
  try { const alertService = require('./alertService'); alertService.createAlert({ level: 'CRITICAL', message: `Emergency priority recommended for ${signal.name} towards ${direction}`, signalId: id }); } catch (e) {}
  return suggestion;
}

async function applyApprovedPlan(id, plan) {
  // store approved plan as current cycleLength and approaches (simulation only)
  const patch = {};
  if (plan.cycleLength) patch.cycleLength = plan.cycleLength;
  if (plan.approaches) patch.approaches = plan.approaches;
  patch.status = 'OPTIMIZED';
  const updated = await updateSignal(id, patch);
  try { broadcastSignalUpdate(id, { applied: true, plan }); } catch (e) {}
  return updated;
}

module.exports = { listSignals, getSignal, createSignal, updateSignal, suggestOptimization, applyApprovedPlan };
