// Traced proportionally from the supplied 1F images. Coordinates use a 150 × 72
// plan grid; dimensions and hidden door positions are approximate, not survey data.
export const SMART_ROOMS = [
  ['103','103 共享会议室',2,7,9,7,'meeting'],['104','104 共享会议室',2,15,9,7,'meeting'],
  ['102','102 办公室',15,2,37,20,'office'],['102-2','102-2 会议室',15,12,8,5,'meeting'],
  ['102-1','102-1 会议室',47,16,5,6,'meeting'],['101','101 办公室',53,2,14,20,'office'],
  ['wc-w','西侧女卫生间',2,23,8,14,'service'],['wc-m','西侧男卫生间',15,26,11,8,'service'],
  ['ahu-w','新风机房',2,50,10,7,'plant'],['105','105 办公室',14,47,37,10,'office'],
  ['105-1','105-1 会议室',2,58,10,12,'meeting'],['105-2','105-2 会议室',14,58,8,5,'meeting'],
  ['105-3','105-3 会议室',23,58,8,5,'meeting'],['finance','财务室',32,58,7,5,'office'],
  ['105-8','105-8 会议室',42,58,8,5,'meeting'],['105-5','105-5 会议室',15,65,11,5,'meeting'],
  ['105-6','105-6 会议室',27,65,8,5,'meeting'],['105-7','105-7 会议室',36,65,10,5,'meeting'],
  ['lift','电梯厅',75,3,6,12,'service'],['ahu-n','空调机房',94,2,10,12,'plant'],
  ['power','变电所',105,2,21,12,'plant'],['electric','强电 / 弱电间',128,2,11,12,'plant'],
  ['network','网络数据机房',140,3,8,11,'plant'],['mother','母婴室',106,18,5,7,'service'],
  ['108','108 办公室',112,18,6,8,'office'],['archive','档案室',119,18,18,12,'plant'],
  ['wc-e1','东侧男卫生间',140,21,8,8,'service'],['wc-e2','东侧女卫生间',130,31,7,5,'service'],
  ['106','106 办公室',127,38,21,32,'office'],['106-3','106-3 会议室',136,41,5,8,'meeting'],
  ['106-2','106-2 会议室',136,50,5,5,'meeting'],['106-1','106-1 会议室',136,56,5,5,'meeting'],
].map(([id,name,x,z,w,d,type])=>({id,name,x,z,w,d,type}));

export const SMART_POIS = [
  ['stair-w','西北楼梯',7,4],['stair-n','北侧楼梯',70,6],['stair-e','东北楼梯',145,17],
  ['stair-se','东侧楼梯',145,34],['stair-sw','西侧楼梯',20,44],['stair-mid','共享楼梯',55,29],
];
