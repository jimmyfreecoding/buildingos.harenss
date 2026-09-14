import { scenes } from './catalogues.js';
import jixingWebgl from '../sites/jixing/models/campusWebgl.js';
import smartWebgl from '../sites/smart/models/campusWebgl.js';
import smartIndoor from '../sites/smart/models/firstFloorIndoor.js';
import smartFloorBackdrop from '../scene/providers/smartFloorBackdrop.js';
import unrealStream from '../scene/providers/unrealStream.js';
import houstonWebgl from '../sites/houston/models/campusWebgl.js';

export const sceneDefinitions = [jixingWebgl, smartWebgl, smartIndoor, smartFloorBackdrop, unrealStream, houstonWebgl];
