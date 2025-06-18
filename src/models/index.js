// Model exports for easy importing
export { BaseModel } from './BaseModel.js';
export { DisasterModel } from './DisasterModel.js';
export { ReportModel } from './ReportModel.js';
export { ResourceModel } from './ResourceModel.js';
export { CacheModel } from './CacheModel.js';

// Create model instances for direct use
export const disasterModel = new DisasterModel();
export const reportModel = new ReportModel();
export const resourceModel = new ResourceModel();
export const cacheModel = new CacheModel();

// Default export with all models
export default {
  BaseModel,
  DisasterModel,
  ReportModel,
  ResourceModel,
  CacheModel,
  disasterModel,
  reportModel,
  resourceModel,
  cacheModel,
};
