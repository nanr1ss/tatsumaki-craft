const CONFIG = {
  appName: 'Татсумаки Калькулятор',
  adminCode: 'CHANGE_ME_ADMIN',
  participantCode: 'participant123'
};

const STORAGE_KEY = 'tatsumaki_calc_data_v1';
const SESSION_KEY = 'tatsumaki_calc_role_v1';
const THEME_KEY = 'tatsumaki_calc_theme_v1';

const state = {
  role: null,
  theme: localStorage.getItem(THEME_KEY) || 'light',
  editingItemId: null,
  editingRecipeId: null,
  pickerContext: null,
  calculatorSnapshot: null,
  data: loadData(),
  builder: {
    slots: Array(9).fill(null),
    resultItemId: '',
    resultQty: 1
  }
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  bindEvents();
  applyTheme(state.theme);
  hydrateSession();
  renderAll();
});

function bindElements() {
  [
    'loginView', 'dashboardView', 'accessCodeInput', 'loginBtn', 'loginMessage', 'roleBadge',
    'themeToggleBtn', 'logoutBtn', 'addItemBtn', 'exportJsonBtn', 'importJsonBtn', 'importFileInput',
    'itemSearchInput', 'itemsList', 'clearRecipeBtn', 'saveRecipeBtn', 'craftGrid', 'resultItemSelect',
    'resultQtyInput', 'recipeCodePreview', 'recipesList', 'calcTargetSelect', 'calcQtyInput', 'calculateBtn',
    'calculatorResult', 'itemModal', 'itemModalTitle', 'itemNameInput', 'itemCommandInput', 'itemModalMessage',
    'closeItemModalBtn', 'cancelItemModalBtn', 'saveItemModalBtn', 'pickerModal', 'pickerSearchInput',
    'closePickerModalBtn', 'pickerItemsList', 'clearPickerSelectionBtn'
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  els.tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
}

function bindEvents() {
  els.loginBtn.addEventListener('click', handleLogin);
  els.accessCodeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleLogin();
  });

  els.themeToggleBtn.addEventListener('click', () => {
    applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  els.logoutBtn.addEventListener('click', () => {
    state.role = null;
    sessionStorage.removeItem(SESSION_KEY);
    els.accessCodeInput.value = '';
    els.loginMessage.textContent = '';
    renderAll();
  });

  els.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
  });

  els.addItemBtn.addEventListener('click', () => openItemModal());
  els.closeItemModalBtn.addEventListener('click', closeItemModal);
  els.cancelItemModalBtn.addEventListener('click', closeItemModal);
  els.saveItemModalBtn.addEventListener('click', saveItemFromModal);
  els.itemSearchInput.addEventListener('input', renderItemsList);

  els.clearRecipeBtn.addEventListener('click', () => {
    if (!isAdmin()) return;
    resetBuilder();
    renderBuilder();
  });

  els.saveRecipeBtn.addEventListener('click', saveRecipeFromBuilder);
  els.resultItemSelect.addEventListener('change', () => {
    state.builder.resultItemId = els.resultItemSelect.value;
    updateRecipePreview();
  });

  els.resultQtyInput.addEventListener('input', () => {
    state.builder.resultQty = normalizePositiveInt(els.resultQtyInput.value);
    els.resultQtyInput.value = state.builder.resultQty;
    updateRecipePreview();
  });

  els.calculateBtn.addEventListener('click', runCalculator);
  els.exportJsonBtn.addEventListener('click', exportJson);
  els.importJsonBtn.addEventListener('click', () => {
    if (!isAdmin()) return;
    els.importFileInput.click();
  });
  els.importFileInput.addEventListener('change', importJson);

  els.closePickerModalBtn.addEventListener('click', closePickerModal);
  els.clearPickerSelectionBtn.addEventListener('click', clearPickerSelection);
  els.pickerSearchInput.addEventListener('input', renderPickerItems);
}

function hydrateSession() {
  const storedRole = sessionStorage.getItem(SESSION_KEY);
  if (storedRole === 'admin' || storedRole === 'participant') {
    state.role = storedRole;
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { items: [], recipes: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : []
    };
  } catch {
    return { items: [], recipes: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function applyTheme(theme) {
  state.theme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = state.theme;
  localStorage.setItem(THEME_KEY, state.theme);
}

function handleLogin() {
  const code = els.accessCodeInput.value.trim();
  if (!code) {
    els.loginMessage.textContent = 'Введите код доступа.';
    return;
  }

  if (code === CONFIG.adminCode) {
    state.role = 'admin';
    sessionStorage.setItem(SESSION_KEY, state.role);
    els.loginMessage.textContent = '';
  } else if (code === CONFIG.participantCode) {
    state.role = 'participant';
    sessionStorage.setItem(SESSION_KEY, state.role);
    els.loginMessage.textContent = '';
  } else {
    els.loginMessage.textContent = 'Неверный код.';
    return;
  }

  renderAll();
}

function renderAll() {
  const loggedIn = Boolean(state.role);
  els.loginView.classList.toggle('hidden', loggedIn);
  els.dashboardView.classList.toggle('hidden', !loggedIn);

  if (!loggedIn) return;

  els.roleBadge.textContent = isAdmin() ? 'Администратор' : 'Участник';
  setActiveTab(document.querySelector('.tab-btn.active')?.dataset.tabTarget || 'itemsTab');
  syncAdminPermissions();
  renderItemsList();
  renderSelects();
  renderBuilder();
  renderRecipesList();
  renderCalculatorResult();
}

function setActiveTab(targetId) {
  els.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === targetId);
  });

  els.tabPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== targetId);
  });
}

function syncAdminPermissions() {
  const admin = isAdmin();
  ['addItemBtn', 'exportJsonBtn', 'importJsonBtn', 'clearRecipeBtn', 'saveRecipeBtn'].forEach((key) => {
    els[key].classList.toggle('hidden', !admin);
  });
  els.resultItemSelect.disabled = !admin;
  els.resultQtyInput.disabled = !admin;
}

function isAdmin() {
  return state.role === 'admin';
}

function renderItemsList() {
  const query = (els.itemSearchInput.value || '').trim().toLowerCase();
  const filtered = state.data.items.filter((item) => {
    return !query || item.name.toLowerCase().includes(query) || item.command.toLowerCase().includes(query);
  });

  if (!filtered.length) {
    els.itemsList.innerHTML = `<div class="empty-state">${query ? 'Ничего не найдено.' : 'Пока нет предметов. Добавьте первый предмет в базе.'}</div>`;
    return;
  }

  els.itemsList.innerHTML = filtered.map((item) => {
    const adminButtons = isAdmin()
      ? `
        <button class="secondary-mini-btn" data-action="edit-item" data-id="${item.id}">Изменить</button>
        <button class="secondary-mini-btn" data-action="delete-item" data-id="${item.id}">Удалить</button>
      `
      : '';

    return `
      <article class="item-card">
        <div class="item-card-head">
          <div>
            <h4>${escapeHtml(item.name)}</h4>
            <div class="item-meta"><code>${escapeHtml(item.command)}</code></div>
          </div>
          <div class="panel-actions">
            <button class="copy-btn" data-action="copy-item" data-id="${item.id}">Копировать /mt hand</button>
            ${adminButtons}
          </div>
        </div>
      </article>
    `;
  }).join('');

  els.itemsList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const { action, id } = button.dataset;
      if (action === 'copy-item') {
        const item = findItem(id);
        copyText(item?.command || '');
      }
      if (action === 'edit-item') openItemModal(id);
      if (action === 'delete-item') deleteItem(id);
    });
  });
}

function openItemModal(itemId = null) {
  if (!isAdmin()) return;
  state.editingItemId = itemId;
  els.itemModalMessage.textContent = '';

  if (itemId) {
    const item = findItem(itemId);
    if (!item) return;
    els.itemModalTitle.textContent = 'Изменить предмет';
    els.itemNameInput.value = item.name;
    els.itemCommandInput.value = item.command;
  } else {
    els.itemModalTitle.textContent = 'Добавить предмет';
    els.itemNameInput.value = '';
    els.itemCommandInput.value = '';
  }

  els.itemModal.showModal();
}

function closeItemModal() {
  els.itemModal.close();
}

function saveItemFromModal() {
  if (!isAdmin()) return;
  const name = els.itemNameInput.value.trim();
  const command = els.itemCommandInput.value.trim();

  if (!name || !command) {
    els.itemModalMessage.textContent = 'Заполните название и значение /mt hand.';
    return;
  }

  const duplicate = state.data.items.find((item) => {
    return item.id !== state.editingItemId && item.name.toLowerCase() === name.toLowerCase();
  });

  if (duplicate) {
    els.itemModalMessage.textContent = 'Предмет с таким названием уже существует.';
    return;
  }

  if (state.editingItemId) {
    const item = findItem(state.editingItemId);
    if (item) {
      item.name = name;
      item.command = command;
    }
  } else {
    state.data.items.push({
      id: makeId(),
      name,
      command
    });
  }

  saveData();
  closeItemModal();
  renderAll();
}

function deleteItem(itemId) {
  if (!isAdmin()) return;
  const item = findItem(itemId);
  if (!item) return;
  const inRecipes = state.data.recipes.some((recipe) => recipe.resultItemId === itemId || recipe.slots.includes(itemId));
  if (inRecipes && !window.confirm('Этот предмет используется в крафтах. Удалить его и очистить связанные слоты?')) return;

  state.data.items = state.data.items.filter((entry) => entry.id !== itemId);
  state.data.recipes = state.data.recipes.map((recipe) => ({
    ...recipe,
    resultItemId: recipe.resultItemId === itemId ? '' : recipe.resultItemId,
    slots: recipe.slots.map((slotId) => slotId === itemId ? null : slotId)
  })).filter((recipe) => recipe.resultItemId);

  if (state.builder.resultItemId === itemId) state.builder.resultItemId = '';
  state.builder.slots = state.builder.slots.map((slotId) => slotId === itemId ? null : slotId);

  saveData();
  renderAll();
}

function renderSelects() {
  renderItemSelect(els.resultItemSelect, state.builder.resultItemId, 'Выберите итоговый предмет');
  const calcSelected = els.calcTargetSelect.value || state.calculatorSnapshot?.targetItemId || '';
  renderItemSelect(els.calcTargetSelect, calcSelected, 'Выберите предмет для расчета');
}

function renderItemSelect(selectEl, selectedId, placeholder) {
  const items = state.data.items.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`].concat(
    items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)
  );
  selectEl.innerHTML = options.join('');
}

function renderBuilder() {
  els.resultQtyInput.value = state.builder.resultQty;
  renderSelects();

  els.craftGrid.innerHTML = state.builder.slots.map((itemId, index) => {
    const item = findItem(itemId);
    return `
      <button class="slot-btn" data-slot-index="${index}" ${isAdmin() ? '' : 'disabled'}>
        <span class="slot-index">Слот ${index + 1}</span>
        <span class="slot-name">${item ? escapeHtml(item.name) : 'Пусто'}</span>
      </button>
    `;
  }).join('');

  els.craftGrid.querySelectorAll('[data-slot-index]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!isAdmin()) return;
      openPickerModal({ type: 'slot', index: Number(button.dataset.slotIndex) });
    });
  });

  updateRecipePreview();
}

function updateRecipePreview() {
  els.recipeCodePreview.value = generateRecipeCode(state.builder);
}

function generateRecipeCode(recipe) {
  const resultItem = findItem(recipe.resultItemId);
  const resultCommand = resultItem ? resultItem.command.trim() : 'null';
  const qty = normalizePositiveInt(recipe.resultQty || 1);
  const rows = [0, 1, 2].map((rowIndex) => {
    const rowValues = recipe.slots.slice(rowIndex * 3, rowIndex * 3 + 3).map((slotId) => {
      const item = findItem(slotId);
      return item ? item.command.trim() : 'null';
    });
    return `  [${rowValues.join(', ')}]`;
  });

  return `recipes.addShaped(${resultCommand} * ${qty}, \n[\n${rows.join(',\n')}\n]);`;
}

function saveRecipeFromBuilder() {
  if (!isAdmin()) return;
  const hasIngredient = state.builder.slots.some(Boolean);
  if (!state.builder.resultItemId) {
    window.alert('Выберите итоговый предмет.');
    return;
  }
  if (!hasIngredient) {
    window.alert('Заполните хотя бы один слот в сетке.');
    return;
  }

  const payload = {
    id: state.editingRecipeId || makeId(),
    slots: [...state.builder.slots],
    resultItemId: state.builder.resultItemId,
    resultQty: normalizePositiveInt(state.builder.resultQty)
  };

  const existingIndex = state.data.recipes.findIndex((recipe) => recipe.id === payload.id);
  if (existingIndex >= 0) {
    state.data.recipes[existingIndex] = payload;
  } else {
    state.data.recipes.push(payload);
  }

  saveData();
  resetBuilder();
  renderAll();
  setActiveTab('recipesTab');
}

function resetBuilder() {
  state.editingRecipeId = null;
  state.builder = {
    slots: Array(9).fill(null),
    resultItemId: '',
    resultQty: 1
  };
}

function renderRecipesList() {
  if (!state.data.recipes.length) {
    els.recipesList.innerHTML = '<div class="empty-state">Пока нет сохраненных крафтов.</div>';
    return;
  }

  const sorted = state.data.recipes.slice().sort((a, b) => {
    const itemA = findItem(a.resultItemId)?.name || '';
    const itemB = findItem(b.resultItemId)?.name || '';
    return itemA.localeCompare(itemB, 'ru');
  });

  els.recipesList.innerHTML = sorted.map((recipe) => {
    const resultItem = findItem(recipe.resultItemId);
    const summary = summarizeIngredients(recipe.slots);
    const chips = summary.length
      ? summary.map((entry) => `<span class="recipe-chip">${escapeHtml(entry.name)} × ${entry.count}</span>`).join('')
      : '<span class="recipe-chip">Без ингредиентов</span>';

    const adminButtons = isAdmin()
      ? `
        <button class="secondary-mini-btn" data-action="edit-recipe" data-id="${recipe.id}">Изменить</button>
        <button class="secondary-mini-btn" data-action="delete-recipe" data-id="${recipe.id}">Удалить</button>
      `
      : '';

    return `
      <article class="recipe-card">
        <div class="recipe-card-head">
          <div>
            <h4>${escapeHtml(resultItem?.name || 'Без названия')} × ${recipe.resultQty}</h4>
            <div class="item-meta"><code>${escapeHtml(resultItem?.command || 'null')}</code></div>
          </div>
          <div class="panel-actions">
            <button class="copy-btn" data-action="copy-recipe" data-id="${recipe.id}">Копировать код</button>
            <button class="copy-btn" data-action="calc-recipe" data-id="${recipe.id}">Открыть в калькуляторе</button>
            ${adminButtons}
          </div>
        </div>
        <div class="recipe-summary">${chips}</div>
      </article>
    `;
  }).join('');

  els.recipesList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const { action, id } = button.dataset;
      if (action === 'copy-recipe') {
        const recipe = state.data.recipes.find((entry) => entry.id === id);
        if (recipe) copyText(generateRecipeCode(recipe));
      }
      if (action === 'calc-recipe') {
        const recipe = state.data.recipes.find((entry) => entry.id === id);
        if (recipe) {
          els.calcTargetSelect.value = recipe.resultItemId;
          els.calcQtyInput.value = recipe.resultQty;
          setActiveTab('calculatorTab');
          runCalculator();
        }
      }
      if (action === 'edit-recipe') editRecipe(id);
      if (action === 'delete-recipe') deleteRecipe(id);
    });
  });
}

function editRecipe(recipeId) {
  if (!isAdmin()) return;
  const recipe = state.data.recipes.find((entry) => entry.id === recipeId);
  if (!recipe) return;
  state.editingRecipeId = recipe.id;
  state.builder = {
    slots: [...recipe.slots],
    resultItemId: recipe.resultItemId,
    resultQty: normalizePositiveInt(recipe.resultQty)
  };
  renderBuilder();
  setActiveTab('recipesTab');
}

function deleteRecipe(recipeId) {
  if (!isAdmin()) return;
  if (!window.confirm('Удалить выбранный крафт?')) return;
  state.data.recipes = state.data.recipes.filter((recipe) => recipe.id !== recipeId);
  saveData();
  if (state.editingRecipeId === recipeId) resetBuilder();
  renderAll();
  setActiveTab('recipesTab');
}

function summarizeIngredients(slots) {
  const counts = new Map();
  slots.filter(Boolean).forEach((itemId) => {
    counts.set(itemId, (counts.get(itemId) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([itemId, count]) => ({
    name: findItem(itemId)?.name || 'Неизвестный предмет',
    count
  }));
}

function openPickerModal(context) {
  state.pickerContext = context;
  els.pickerSearchInput.value = '';
  renderPickerItems();
  els.pickerModal.showModal();
}

function closePickerModal() {
  els.pickerModal.close();
  state.pickerContext = null;
}

function renderPickerItems() {
  const query = els.pickerSearchInput.value.trim().toLowerCase();
  const items = state.data.items.filter((item) => {
    return !query || item.name.toLowerCase().includes(query) || item.command.toLowerCase().includes(query);
  });

  if (!items.length) {
    els.pickerItemsList.innerHTML = '<div class="empty-state">Нет подходящих предметов.</div>';
    return;
  }

  els.pickerItemsList.innerHTML = items.map((item) => `
    <button class="picker-item-btn" data-picker-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span><code>${escapeHtml(item.command)}</code></span>
    </button>
  `).join('');

  els.pickerItemsList.querySelectorAll('[data-picker-id]').forEach((button) => {
    button.addEventListener('click', () => selectPickerItem(button.dataset.pickerId));
  });
}

function selectPickerItem(itemId) {
  if (!state.pickerContext) return;
  if (state.pickerContext.type === 'slot') {
    state.builder.slots[state.pickerContext.index] = itemId;
  }
  if (state.pickerContext.type === 'result') {
    state.builder.resultItemId = itemId;
    els.resultItemSelect.value = itemId;
  }
  closePickerModal();
  renderBuilder();
}

function clearPickerSelection() {
  if (!state.pickerContext) return;
  if (state.pickerContext.type === 'slot') {
    state.builder.slots[state.pickerContext.index] = null;
  }
  if (state.pickerContext.type === 'result') {
    state.builder.resultItemId = '';
    els.resultItemSelect.value = '';
  }
  closePickerModal();
  renderBuilder();
}

function runCalculator() {
  const targetItemId = els.calcTargetSelect.value;
  const quantity = normalizePositiveInt(els.calcQtyInput.value);
  els.calcQtyInput.value = quantity;

  if (!targetItemId) {
    state.calculatorSnapshot = {
      error: 'Сначала выберите предмет.'
    };
    renderCalculatorResult();
    return;
  }

  try {
    const result = calculateRequirements(targetItemId, quantity);
    state.calculatorSnapshot = {
      targetItemId,
      quantity,
      ...result
    };
  } catch (error) {
    state.calculatorSnapshot = {
      targetItemId,
      quantity,
      error: error.message || 'Не удалось рассчитать ресурсы.'
    };
  }

  renderCalculatorResult();
}

function calculateRequirements(targetItemId, quantity) {
  const base = new Map();
  const steps = [];

  function walk(itemId, qtyNeeded, path = []) {
    if (path.includes(itemId)) {
      const cycleNames = [...path, itemId].map((id) => findItem(id)?.name || 'Неизвестный').join(' → ');
      throw new Error(`Обнаружен цикл крафтов: ${cycleNames}`);
    }

    const recipe = state.data.recipes.find((entry) => entry.resultItemId === itemId);
    const item = findItem(itemId);

    if (!recipe) {
      base.set(itemId, (base.get(itemId) || 0) + qtyNeeded);
      return;
    }

    const craftsNeeded = Math.ceil(qtyNeeded / normalizePositiveInt(recipe.resultQty));
    steps.push({
      itemName: item?.name || 'Неизвестный предмет',
      qtyNeeded,
      recipeOutput: normalizePositiveInt(recipe.resultQty),
      craftsNeeded
    });

    recipe.slots.filter(Boolean).forEach((ingredientId) => {
      walk(ingredientId, craftsNeeded, [...path, itemId]);
    });
  }

  walk(targetItemId, quantity);

  const baseItems = Array.from(base.entries())
    .map(([itemId, qty]) => ({
      itemId,
      name: findItem(itemId)?.name || 'Неизвестный предмет',
      command: findItem(itemId)?.command || 'null',
      qty
    }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'));

  return { baseItems, steps };
}

function renderCalculatorResult() {
  const snapshot = state.calculatorSnapshot;
  const itemsCount = state.data.items.length;

  if (!snapshot) {
    els.calculatorResult.innerHTML = `<div class="empty-state">${itemsCount ? 'Выберите предмет и нажмите «Рассчитать».' : 'Сначала добавьте предметы и крафты.'}</div>`;
    return;
  }

  if (snapshot.error) {
    els.calculatorResult.innerHTML = `<div class="empty-state">${escapeHtml(snapshot.error)}</div>`;
    return;
  }

  const targetItem = findItem(snapshot.targetItemId);
  const baseList = snapshot.baseItems.length
    ? snapshot.baseItems.map((entry) => `
        <li>
          <strong>${escapeHtml(entry.name)}</strong> × ${entry.qty}<br />
          <code>${escapeHtml(entry.command)}</code>
        </li>
      `).join('')
    : '<li>Базовые ресурсы не требуются.</li>';

  const stepsList = snapshot.steps.length
    ? snapshot.steps.map((step) => `
        <li>
          ${escapeHtml(step.itemName)} — нужно ${step.qtyNeeded}, крафт запустить ${step.craftsNeeded} раз, выход за крафт ${step.recipeOutput}
        </li>
      `).join('')
    : '<li>Для предмета нет рецепта, он считается базовым ресурсом.</li>';

  els.calculatorResult.innerHTML = `
    <section class="result-box">
      <h4>Итог для ${escapeHtml(targetItem?.name || 'предмета')} × ${snapshot.quantity}</h4>
      <p>Список всех базовых ресурсов, которые понадобятся.</p>
      <ul>${baseList}</ul>
    </section>
    <section class="step-box">
      <h4>Шаги расчета</h4>
      <ul>${stepsList}</ul>
    </section>
  `;
}

function exportJson() {
  if (!isAdmin()) return;
  const payload = {
    exportedAt: new Date().toISOString(),
    items: state.data.items,
    recipes: state.data.recipes
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tatsumaki-calculator-data.json';
  link.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  if (!isAdmin()) return;
  const [file] = event.target.files || [];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      state.data = {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        recipes: Array.isArray(parsed.recipes) ? parsed.recipes : []
      };
      saveData();
      resetBuilder();
      state.calculatorSnapshot = null;
      renderAll();
    } catch {
      window.alert('Файл JSON не удалось прочитать.');
    }
    event.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function findItem(itemId) {
  return state.data.items.find((item) => item.id === itemId) || null;
}

function normalizePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt('Скопируйте вручную:', text);
  }
}
