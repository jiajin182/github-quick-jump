'use strict';

const STORAGE_KEY = 'gh-quick-jump-custom';
const SAMPLE_OWNER = 'vuejs';
const SAMPLE_REPO = 'core';

const form = document.getElementById('form');
const labelInput = document.getElementById('label');
const descInput = document.getElementById('desc');
const templateInput = document.getElementById('template');
const previewBox = document.getElementById('preview');
const errorBox = document.getElementById('error');
const submitBtn = document.getElementById('submit');
const cancelBtn = document.getElementById('cancel');
const listBox = document.getElementById('list');
const countBox = document.getElementById('count');
const emptyBox = document.getElementById('empty');

let items = [];
let editingIndex = -1;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function fillTemplate(template, owner, repo) {
  return template
    .replace(/\{owner\}/g, encodeURIComponent(owner))
    .replace(/\{repo\}/g, encodeURIComponent(repo));
}

function showError(message) {
  errorBox.textContent = message || '';
  errorBox.hidden = !message;
}

function updatePreview() {
  previewBox.textContent = '';
  const template = templateInput.value.trim();
  if (!template || !isHttpUrl(template)) return;
  previewBox.append(`预览（以 ${SAMPLE_OWNER}/${SAMPLE_REPO} 为例）：`);
  const strong = document.createElement('b');
  strong.textContent = fillTemplate(template, SAMPLE_OWNER, SAMPLE_REPO);
  previewBox.append(strong);
}

function resetForm() {
  editingIndex = -1;
  form.reset();
  submitBtn.textContent = '添加';
  cancelBtn.hidden = true;
  showError('');
  updatePreview();
}

function readForm() {
  const label = labelInput.value.trim();
  const desc = descInput.value.trim();
  const template = templateInput.value.trim();
  if (!label) return { error: '请填写名称。' };
  if (!template) return { error: '请填写地址模板。' };
  if (!isHttpUrl(template)) return { error: '地址模板必须是完整的 http:// 或 https:// 链接。' };
  return { value: { label, desc, template } };
}

function persist() {
  chrome.storage.sync.set({ [STORAGE_KEY]: items }, () => {
    if (chrome.runtime.lastError) {
      showError(`保存失败：${chrome.runtime.lastError.message}`);
      return;
    }
    render();
  });
}

function startEdit(index) {
  const item = items[index];
  editingIndex = index;
  labelInput.value = item.label;
  descInput.value = item.desc;
  templateInput.value = item.template;
  submitBtn.textContent = '保存修改';
  cancelBtn.hidden = false;
  showError('');
  updatePreview();
  labelInput.focus();
}

function removeItem(index) {
  items.splice(index, 1);
  if (editingIndex === index) resetForm();
  else if (editingIndex > index) editingIndex -= 1;
  persist();
}

function render() {
  listBox.textContent = '';
  countBox.textContent = String(items.length);
  emptyBox.hidden = items.length > 0;

  items.forEach((item, index) => {
    const row = document.createElement('li');

    const meta = document.createElement('div');
    meta.className = 'meta';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.label;
    if (item.desc) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item.desc;
      name.append(tag);
    }

    const url = document.createElement('span');
    url.className = 'url';
    url.textContent = item.template;

    meta.append(name, url);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => startEdit(index));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove';
    removeBtn.textContent = '删除';
    removeBtn.addEventListener('click', () => removeItem(index));

    actions.append(editBtn, removeBtn);
    row.append(meta, actions);
    listBox.appendChild(row);
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = readForm();
  if (result.error) {
    showError(result.error);
    return;
  }
  if (editingIndex >= 0) items[editingIndex] = result.value;
  else items.push(result.value);
  resetForm();
  persist();
});

cancelBtn.addEventListener('click', resetForm);
templateInput.addEventListener('input', updatePreview);

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  const raw = data && data[STORAGE_KEY];
  items = Array.isArray(raw)
    ? raw
        .filter((item) => item && typeof item.label === 'string' && typeof item.template === 'string')
        .map((item) => ({
          label: item.label,
          desc: typeof item.desc === 'string' ? item.desc : '',
          template: item.template
        }))
    : [];
  render();
});