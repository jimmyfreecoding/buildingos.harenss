import { cards } from './catalogues.js';
import overview from '../cards/overview/card.js';
import environment from '../cards/environment/card.js';
import monitor from '../cards/monitor/card.js';
import alarm from '../cards/alarm/card.js';
import people from '../cards/people/card.js';
import parking from '../cards/parking/card.js';
import traffic from '../cards/traffic/card.js';
import energy from '../cards/energy/card.js';
import summary from '../cards/summary/card.js';
import building from '../cards/building/card.js';
import plan from '../cards/plan/card.js';
import topology from '../cards/topology/card.js';
import strategyMap from '../cards/strategy-map/card.js';
import warehouse from '../cards/warehouse/card.js';

export const cardDefinitions = [
  overview, environment, monitor, alarm, people, parking, traffic, energy,
  summary, building, plan, topology, strategyMap, warehouse,
];
