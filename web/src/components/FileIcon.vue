<script setup lang="ts">
/**
 * 文件格式图标组件
 * ----------------------------------------------------------------------------
 * 根据文件扩展名显示对应彩色图标徽章
 * PDF 红、Word 蓝、Excel 绿、PPT 橙、图片紫、文本灰、压缩包黄
 */
import { computed } from 'vue';

const props = defineProps<{
  ext: string;
  size?: 'sm' | 'md' | 'lg';
}>();

/** 尺寸映射 */
const sizeClass = computed(() => {
  const map = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-12 w-12 text-xs',
    lg: 'h-16 w-16 text-sm',
  };
  return map[props.size || 'md'];
});

/** 扩展名 → 图标标签与配色 */
const iconMeta = computed(() => {
  const ext = props.ext.toLowerCase();
  const map: Record<string, { label: string; bg: string; text: string }> = {
    pdf: { label: 'PDF', bg: 'bg-red-500/20', text: 'text-red-400' },
    doc: { label: 'DOC', bg: 'bg-blue-500/20', text: 'text-blue-400' },
    docx: { label: 'DOC', bg: 'bg-blue-500/20', text: 'text-blue-400' },
    xls: { label: 'XLS', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    xlsx: { label: 'XLS', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    ppt: { label: 'PPT', bg: 'bg-orange-500/20', text: 'text-orange-400' },
    pptx: { label: 'PPT', bg: 'bg-orange-500/20', text: 'text-orange-400' },
    txt: { label: 'TXT', bg: 'bg-slate-500/20', text: 'text-slate-300' },
    md: { label: 'MD', bg: 'bg-slate-500/20', text: 'text-slate-300' },
    json: { label: 'JSON', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    csv: { label: 'CSV', bg: 'bg-teal-500/20', text: 'text-teal-400' },
    jpg: { label: 'IMG', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    jpeg: { label: 'IMG', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    png: { label: 'IMG', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    gif: { label: 'IMG', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    webp: { label: 'IMG', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    svg: { label: 'SVG', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    zip: { label: 'ZIP', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    rar: { label: 'RAR', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  };
  return map[ext] || { label: ext.slice(0, 4).toUpperCase() || 'FILE', bg: 'bg-slate-500/20', text: 'text-slate-300' };
});
</script>

<template>
  <div
    :class="['flex items-center justify-center rounded-lg font-display font-semibold', sizeClass, iconMeta.bg, iconMeta.text]"
  >
    {{ iconMeta.label }}
  </div>
</template>
