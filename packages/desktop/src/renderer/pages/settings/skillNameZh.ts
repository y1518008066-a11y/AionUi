/**
 * 技能名称中英映射表
 * Skill name Chinese-English mapping
 * 
 * 当后端返回的技能名为英文时，通过此映射显示中文名。
 * 后续新增技能只需在此文件中追加即可。
 */
export const SKILL_NAME_ZH: Record<string, string> = {
  // === 系统 / System ===
  'skill-creator': '技能创建器',
  'cron': '定时任务',

  // === 文档 / Office ===
  'officecli': 'Office 文档工具',
  'officecli-docx': 'Word 文档',
  'officecli-xlsx': 'Excel 表格',
  'officecli-pptx': 'PPT 演示',
  'officecli-pitch-deck': '融资路演 PPT',
  'officecli-academic-paper': '学术论文',
  'officecli-data-dashboard': '数据仪表盘',
  'officecli-financial-model': '财务模型',
  'officecli-word-form': 'Word 表单',
  'morph-ppt': '平滑过渡 PPT',
  'morph-ppt-3d': '3D 平滑过渡 PPT',
  'pdf': 'PDF 工具',

  // === 可视化 / Visualization ===
  'mermaid': '流程图/图表',

  // === AI / 平台 ===
  'aionui-skills': 'AionUi 技能中心',
  'aionui-webui-setup': 'AionUi 远程访问配置',
  'openclaw-setup': 'OpenClaw 配置',

  // === 社交 / Social ===
  'moltbook': 'AI 社交网络',
  'x-recruiter': 'X 招聘发布',
  'xiaohongshu-recruiter': '小红书招聘发布',
  'star-office-helper': '可视化面板助手',

  // === 其他 / Others ===
  'story-roleplay': '角色扮演/人物卡',
  'weixin-file-send': '微信文件发送',
};

/**
 * 获取技能的中文显示名，若无映射则返回原始名
 */
export function getSkillDisplayName(englishName: string): string {
  return SKILL_NAME_ZH[englishName] || englishName;
}
