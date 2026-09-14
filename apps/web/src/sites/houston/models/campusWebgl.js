import { createHoustonWarehouse } from '../../../scene/createHoustonWarehouse.js';
export default {
  id: 'houston-webgl', label: 'Houston · CAD 仓库模型', kind: 'webgl',
  capabilities: ['focus', 'reset', 'top', 'orbit', 'pause', 'labels', 'studio', 'view', 'environment', 'mode', 'layer'],
  create(container, context = {}) { return createHoustonWarehouse(container, context); },
};
