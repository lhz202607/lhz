// 前端角色数据副本（与 shared/types.ts 一致，供 UI 渲染）
import { RoleId } from '@/shared/types';

export interface RoleInfo {
  id: RoleId;
  name: string;
  faction: 'xuyuan' | 'laochaofeng';
  title: string;
  ability: string;
  appraiseCount: number;
  bio: string;
  color: string;       // 主题色
  glyph: string;       // 标识字
}

export const ROLE_INFO: Record<RoleId, RoleInfo> = {
  xuyuan: {
    id: 'xuyuan', name: '许愿', faction: 'xuyuan', title: '好人主公',
    ability: '每轮可鉴定 2 件兽首真伪。需隐藏身份，被药不然锁定则鉴宝能力丧失。',
    appraiseCount: 2, bio: '古董世家许家传人，五脉之首，鉴宝眼力超群。',
    color: '#c9a961', glyph: '愿',
  },
  fangzhen: {
    id: 'fangzhen', name: '方震', faction: 'xuyuan', title: '好人老二 · 预言家',
    ability: '不会鉴宝。每轮可查验一名玩家所属阵营。若被药不然封印，许愿同时丧失鉴宝��力。',
    appraiseCount: 0, bio: '刑警出身，心思缜密，专司鉴人。',
    color: '#8b9dc3', glyph: '震',
  },
  jiyunfu: {
    id: 'jiyunfu', name: '姬云浮', faction: 'xuyuan', title: '山林隐士',
    ability: '每轮可鉴 1 件兽首，且不受老朝奉颠倒影响。一旦被药不然封印，整局永久失去鉴宝能力。',
    appraiseCount: 1, bio: '博学多才的隐士，眼力通天，但身娇体弱。',
    color: '#6b8e7f', glyph: '浮',
  },
  huangyanyan: {
    id: 'huangyanyan', name: '黄烟烟', faction: 'xuyuan', title: '好人平民',
    ability: '每轮可鉴 1 件兽首，但三轮中会随机有一轮无法鉴宝。',
    appraiseCount: 1, bio: '黄家后人，与许愿关系匪浅。',
    color: '#b07d9e', glyph: '烟',
  },
  muhujianai: {
    id: 'muhujianai', name: '木户加奈', faction: 'xuyuan', title: '好人平民',
    ability: '每轮可鉴 1 件兽首，但三轮中会随机有一轮无法鉴宝。',
    appraiseCount: 1, bio: '日本学者，对中国古董颇有研究。',
    color: '#9c7b5a', glyph: '奈',
  },
  laochaofeng: {
    id: 'laochaofeng', name: '老朝奉', faction: 'laochaofeng', title: '坏人主公',
    ability: '每轮可鉴 1 件兽首，并可选择「颠倒乾坤」：使用后，所有好人本轮的鉴宝结果真假互换。',
    appraiseCount: 1, bio: '潜伏古董界的黑暗势力首脑，神出鬼没。',
    color: '#8b3a3a', glyph: '奉',
  },
  yaoburan: {
    id: 'yaoburan', name: '药不然', faction: 'laochaofeng', title: '坏人老二 · 刺客',
    ability: '每轮可鉴 1 件兽首。每轮可选择封印一名玩家，使其本轮无法鉴宝且技能失效。',
    appraiseCount: 1, bio: '药家传人，表面吊儿郎当，实则深不可测。',
    color: '#6d4c8b', glyph: '药',
  },
  zhengguoqu: {
    id: 'zhengguoqu', name: '郑国渠', faction: 'laochaofeng', title: '坏人小弟',
    ability: '每轮可鉴 1 件兽首，并可选择一件兽首「封存」，使其本轮无法被任何人鉴定。开局不知晓队友。',
    appraiseCount: 1, bio: '郑家后人，行事低调，暗中搅局。',
    color: '#5c6b4a', glyph: '渠',
  },
};

export const ZODIAC_NAMES = [
  '鼠首', '牛首', '虎首', '兔首', '龙首', '蛇首',
  '马首', '羊首', '猴首', '鸡首', '狗首', '猪首',
];
