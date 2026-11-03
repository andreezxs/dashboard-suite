import Chart from 'chart.js/auto'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STORAGE_KEY = 'finora.v2'

const INCOME_CATEGORIES = [
  'Salario',
  'Freelance',
  'Investimentos',
  'Aluguel recebido',
  'Vendas',
  'Presente',
  'Reembolso',
  'Outros'
]

const EXPENSE_CATEGORIES = [
  'Moradia',
  'Alimentacao',
  'Transporte',
  'Saude',
  'Educacao',
  'Lazer',
  'Contas',
  'Assinaturas',
  'Compras',
  'Impostos',
  'Cartao',
  'Outros'
]

const PAYMENT_LABELS = {
  pix: 'PIX',
  credit: 'Cartao de credito',
  debit: 'Debito',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  transfer: 'Transferencia'
}

const ACCOUNT_TYPE_LABELS = {
  checking: 'Corrente',
  savings: 'Poupanca',
  credit: 'Cartao de credito',
  wallet: 'Carteira',
  invest: 'Investimentos'
}

const VIEW_COPY = {
  dashboard: ['Painel', 'Visao consolidada do mes, por perfil e por conta'],
  transactions: ['Lancamentos', 'Receitas e despesas do perfil ativo'],
  recurring: ['Fixos e variaveis', 'Gerencie entradas recorrentes e pontuais'],
  accounts: ['Contas', 'Divida o saldo deste perfil em bancos e carteiras'],
  import: ['Importar CSV', 'Fatura, extrato ou planilha bancaria'],
  reports: ['Relatorios', 'Resumo pronto para exportar em PDF'],
  profiles: ['Perfis', 'Cada perfil tem contas, lancamentos e meta proprios']
}

const PALETTE = ['#ABE054', '#FA553C', '#BF5AF2', '#F5F2EA', '#7bc92e', '#c43d2a', '#d4ff8a', '#ff8a78']

const uid = () => crypto.randomUUID()
const todayISO = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => todayISO().slice(0, 7)

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const parseAmount = (raw) => {
  if (typeof raw === 'number') return raw
  const text = String(raw || '').trim()
  if (!text) return 0
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/[^\d.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

const parseDate = (raw) => {
  const text = String(raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const br = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (br) {
    const d = br[1].padStart(2, '0')
    const m = br[2].padStart(2, '0')
    const y = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${y}-${m}-${d}`
  }
  const dt = new Date(text)
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10)
  return todayISO()
}

const detectType = (raw, amount) => {
  const t = String(raw || '').toLowerCase()
  if (['receita', 'entrada', 'income', 'credito', 'crédito', 'c'].includes(t)) return 'income'
  if (['despesa', 'saida', 'saída', 'expense', 'debito', 'débito', 'd'].includes(t)) return 'expense'
  if (amount < 0) return 'expense'
  return 'income'
}

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[Number(m) - 1]}/${y.slice(2)}`
}

function seedState() {
  const p1 = uid()
  const p2 = uid()
  const a1 = uid()
  const a2 = uid()
  const a3 = uid()
  const a4 = uid()
  const month = currentMonth()
  const day = (d) => `${month}-${String(d).padStart(2, '0')}`
  return {
    activeProfileId: p1,
    profiles: [
      { id: p1, name: 'Pessoal', goal: 4000, color: '#ABE054' },
      { id: p2, name: 'Casa', goal: 2500, color: '#FA553C' }
    ],
    accounts: [
      { id: a1, profileId: p1, name: 'Nubank', bank: 'Nubank', type: 'checking' },
      { id: a2, profileId: p1, name: 'Inter', bank: 'Inter', type: 'checking' },
      { id: a3, profileId: p1, name: 'Carteira', bank: 'Dinheiro', type: 'wallet' },
      { id: a4, profileId: p2, name: 'Caixa Casa', bank: 'Caixa', type: 'checking' }
    ],
    transactions: [
      { id: uid(), profileId: p1, accountId: a1, date: day(1), description: 'Salario CLT', type: 'income', category: 'Salario', amount: 8200, paymentMethod: 'transfer', recurrence: 'fixed' },
      { id: uid(), profileId: p1, accountId: a2, date: day(3), description: 'Freelance design', type: 'income', category: 'Freelance', amount: 1800, paymentMethod: 'pix', recurrence: 'variable' },
      { id: uid(), profileId: p1, accountId: a1, date: day(5), description: 'Aluguel', type: 'expense', category: 'Moradia', amount: 2100, paymentMethod: 'pix', recurrence: 'fixed' },
      { id: uid(), profileId: p1, accountId: a1, date: day(6), description: 'Mercado', type: 'expense', category: 'Alimentacao', amount: 640, paymentMethod: 'debit', recurrence: 'variable' },
      { id: uid(), profileId: p1, accountId: a1, date: day(8), description: 'Academia', type: 'expense', category: 'Saude', amount: 149, paymentMethod: 'credit', recurrence: 'fixed' },
      { id: uid(), profileId: p1, accountId: a2, date: day(10), description: 'Combustivel', type: 'expense', category: 'Transporte', amount: 280, paymentMethod: 'credit', recurrence: 'variable' },
      { id: uid(), profileId: p1, accountId: a1, date: day(12), description: 'Netflix + Spotify', type: 'expense', category: 'Assinaturas', amount: 74.9, paymentMethod: 'credit', recurrence: 'fixed' },
      { id: uid(), profileId: p1, accountId: a3, date: day(14), description: 'Padaria', type: 'expense', category: 'Alimentacao', amount: 32, paymentMethod: 'cash', recurrence: 'variable' },
      { id: uid(), profileId: p1, accountId: a2, date: day(15), description: 'Dividendos', type: 'income', category: 'Investimentos', amount: 320, paymentMethod: 'transfer', recurrence: 'variable' },
      { id: uid(), profileId: p2, accountId: a4, date: day(2), description: 'Condominio', type: 'expense', category: 'Moradia', amount: 890, paymentMethod: 'boleto', recurrence: 'fixed' },
      { id: uid(), profileId: p2, accountId: a4, date: day(7), description: 'Supermercado casa', type: 'expense', category: 'Alimentacao', amount: 510, paymentMethod: 'pix', recurrence: 'variable' },
      { id: uid(), profileId: p2, accountId: a4, date: day(4), description: 'Aluguel quarto', type: 'income', category: 'Aluguel recebido', amount: 1200, paymentMethod: 'pix', recurrence: 'fixed' }
    ]
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw)
    if (!parsed.profiles?.length) return seedState()
    if (!parsed.accounts) parsed.accounts = []
    return parsed
  } catch {
    return seedState()
  }
}

let state = loadState()
let month = currentMonth()
let accountFilter = 'all'
const charts = {}

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function activeProfile() {
  return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0]
}

function profileAccounts(profileId = state.activeProfileId) {
  return state.accounts.filter((a) => a.profileId === profileId)
}

function accountById(id) {
  return state.accounts.find((a) => a.id === id)
}

function ensureAccount() {
  const list = profileAccounts()
  if (list.length) return list[0]
  const account = {
    id: uid(),
    profileId: state.activeProfileId,
    name: 'Carteira',
    bank: 'Dinheiro',
    type: 'wallet'
  }
  state.accounts.push(account)
  save()
  return account
}

function allTx() {
  return state.transactions.filter((t) => {
    if (t.profileId !== state.activeProfileId) return false
    if (accountFilter !== 'all' && t.accountId !== accountFilter) return false
    return true
  })
}

function monthTx() {
  return allTx().filter((t) => t.date.startsWith(month))
}

function accountTx(accountId) {
  return state.transactions.filter((t) => t.accountId === accountId)
}

function totals(list = monthTx()) {
  const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return {
    income,
    expense,
    profit: income - expense,
    countIn: list.filter((t) => t.type === 'income').length,
    countOut: list.filter((t) => t.type === 'expense').length
  }
}

function fillCategories(select, type) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  select.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join('')
}

function fillProfiles() {
  const select = $('#profileSelect')
  select.innerHTML = state.profiles.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')
  select.value = state.activeProfileId
}

function fillAccountSelects() {
  const accounts = profileAccounts()
  const filter = $('#accountFilter')
  const current = accountFilter
  filter.innerHTML = `<option value="all">Todas as contas</option>` +
    accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')
  accountFilter = accounts.some((a) => a.id === current) ? current : 'all'
  filter.value = accountFilter

  const formSelect = $('#txForm').accountId
  if (formSelect) {
    formSelect.innerHTML = accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')
  }
}

function replayTableMotion(root) {
  const rows = root.querySelectorAll('tbody tr, .recurring-list li, .account-list li, .profile-list li')
  rows.forEach((row, i) => {
    row.style.animation = 'none'
    row.offsetHeight
    row.style.setProperty('--i', String(i))
    row.style.animation = ''
  })
}

function setView(name) {
  $$('[data-view]').forEach((b) => {
    if (b.tagName === 'A') return
    b.classList.toggle('active', b.dataset.view === name)
  })
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`))
  const [title, sub] = VIEW_COPY[name]
  $('#viewTitle').textContent = title
  $('#viewSubtitle').innerHTML = sub
  $('#drawer').classList.remove('open')
  const active = $(`#view-${name}`)
  if (active) replayTableMotion(active)
}

function groupBy(list, key) {
  const map = {}
  list.forEach((item) => {
    const k = item[key]
    map[k] = (map[k] || 0) + item.amount
  })
  return map
}

function lastMonths(n = 6) {
  const [y, m] = month.split('-').map(Number)
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function upsertChart(id, config) {
  if (charts[id]) charts[id].destroy()
  const canvas = document.getElementById(id)
  if (!canvas) return
  charts[id] = new Chart(canvas, config)
}

function moneyPct(part, total) {
  if (!total) return '0%'
  return `${Math.round((Math.abs(part) / Math.abs(total)) * 100)}%`
}

const percentLabels = {
  id: 'percentLabels',
  afterDatasetsDraw(chart) {
    const type = chart.config.type
    if (type !== 'doughnut' && type !== 'bar') return
    const { ctx } = chart
    ctx.save()
    ctx.font = '700 11px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chart.data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di)
      const total = dataset.data.reduce((sum, n) => sum + Math.abs(Number(n || 0)), 0)
      meta.data.forEach((el, i) => {
        const value = Number(dataset.data[i] || 0)
        if (!value || !total) return
        const label = moneyPct(value, total)
        if (type === 'doughnut') {
          const { x, y } = el.tooltipPosition()
          ctx.fillStyle = '#F5F2EA'
          ctx.fillText(label, x, y)
          return
        }
        ctx.fillStyle = '#F5F2EA'
        ctx.fillText(label, el.x, el.y - 10)
      })
    })
    ctx.restore()
  }
}

function chartDefaults() {
  Chart.register(percentLabels)
  Chart.defaults.color = 'rgba(245, 242, 234, 0.64)'
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)'
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif'
}

function renderKpis() {
  const monthTotals = totals()
  const lifetime = totals(allTx())
  const profile = activeProfile()
  const goal = Number(profile.goal || 0)
  const pct = goal > 0 ? Math.max(0, Math.min(100, (monthTotals.profit / goal) * 100)) : 0
  const accLabel = accountFilter === 'all' ? 'todas as contas' : (accountById(accountFilter)?.name || 'conta')

  $('#kpiBalance').textContent = money(lifetime.profit)
  $('#kpiBalanceHint').textContent = `${allTx().length} lancamentos · ${accLabel}`
  $('#kpiIncome').textContent = money(monthTotals.income)
  $('#kpiIncomeHint').textContent = `${monthTotals.countIn} lancamentos`
  $('#kpiExpense').textContent = money(monthTotals.expense)
  $('#kpiExpenseHint').textContent = `${monthTotals.countOut} lancamentos`
  $('#kpiProfit').textContent = money(monthTotals.profit)
  $('#kpiProfitHint').textContent = monthTotals.profit >= 0 ? 'mes positivo' : 'mes negativo'
  $('#kpiGoal').textContent = money(goal)
  $('#goalBar').style.width = `${pct}%`
  $('#kpiGoalHint').textContent = `${pct.toFixed(0)}% da meta de lucro`
  $('#liveHint').textContent = `${profile.name} · ${accLabel}`
}

function renderAccountStrip() {
  const el = $('#accountStrip')
  const accounts = profileAccounts()
  if (!accounts.length) {
    el.innerHTML = '<article class="account-card"><small>Contas</small><strong>Nenhuma conta</strong><em>Crie uma na aba Contas</em></article>'
    return
  }
  el.innerHTML = accounts.map((a, i) => {
    const t = totals(accountTx(a.id))
    return `
      <article class="account-card" data-filter-account="${a.id}" style="--i:${i}">
        <small>${a.bank} · ${ACCOUNT_TYPE_LABELS[a.type] || a.type}</small>
        <strong>${money(t.profit)}</strong>
        <em>${a.name}</em>
      </article>
    `
  }).join('')
}

function renderCharts() {
  const list = monthTx()
  const t = totals(list)
  const expenses = groupBy(list.filter((x) => x.type === 'expense'), 'category')
  const incomes = groupBy(list.filter((x) => x.type === 'income'), 'category')
  const months = lastMonths(6)
  const seriesIn = months.map((m) => totals(allTx().filter((x) => x.date.startsWith(m))).income)
  const seriesOut = months.map((m) => totals(allTx().filter((x) => x.date.startsWith(m))).expense)
  const noHover = { events: [], plugins: { tooltip: { enabled: false } } }

  upsertChart('chartIncomeExpense', {
    type: 'bar',
    data: {
      labels: ['Receitas', 'Despesas', 'Lucro'],
      datasets: [{
        data: [t.income, t.expense, t.profit],
        backgroundColor: ['#ABE054', '#FA553C', '#F5F2EA'],
        borderRadius: 12
      }]
    },
    options: {
      ...noHover,
      layout: { padding: { top: 18 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { y: { beginAtZero: true } }
    }
  })

  upsertChart('chartExpenseCat', {
    type: 'doughnut',
    data: {
      labels: Object.keys(expenses),
      datasets: [{ data: Object.values(expenses), backgroundColor: PALETTE, borderWidth: 0 }]
    },
    options: {
      ...noHover,
      plugins: { legend: { position: 'bottom' }, tooltip: { enabled: false } }
    }
  })

  upsertChart('chartIncomeCat', {
    type: 'doughnut',
    data: {
      labels: Object.keys(incomes),
      datasets: [{ data: Object.values(incomes), backgroundColor: PALETTE, borderWidth: 0 }]
    },
    options: {
      ...noHover,
      plugins: { legend: { position: 'bottom' }, tooltip: { enabled: false } }
    }
  })

  upsertChart('chartMonthly', {
    type: 'line',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: 'Receitas', data: seriesIn, borderColor: '#ABE054', tension: 0.35, fill: false },
        { label: 'Despesas', data: seriesOut, borderColor: '#FA553C', tension: 0.35, fill: false }
      ]
    },
    options: {
      ...noHover,
      plugins: { legend: { position: 'bottom' }, tooltip: { enabled: false } },
      scales: { y: { beginAtZero: true } }
    }
  })
}

function filteredTx() {
  const q = ($('#txSearch').value || '').toLowerCase()
  const type = $('#txTypeFilter').value
  const pay = $('#txPayFilter').value
  return monthTx().filter((t) => {
    const acc = accountById(t.accountId)?.name || ''
    const matchQ = !q || `${t.description} ${t.category} ${acc}`.toLowerCase().includes(q)
    const matchT = type === 'all' || t.type === type
    const matchP = pay === 'all' || t.paymentMethod === pay
    return matchQ && matchT && matchP
  }).sort((a, b) => b.date.localeCompare(a.date))
}

function renderTable() {
  const rows = filteredTx()
  const body = $('#txTable')
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty">Nenhum lancamento neste filtro.</td></tr>`
    return
  }
  body.innerHTML = rows.map((t, i) => `
    <tr style="--i:${i}">
      <td>${t.date.split('-').reverse().join('/')}</td>
      <td>${t.description}</td>
      <td>${accountById(t.accountId)?.name || '-'}</td>
      <td><span class="tag ${t.type}">${t.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
      <td>${t.category}</td>
      <td>${PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod}</td>
      <td>${t.recurrence === 'fixed' ? 'Fixa' : 'Variavel'}</td>
      <td class="num">${money(t.amount)}</td>
      <td>
        <button class="btn btn-ghost" data-edit="${t.id}">Editar</button>
        <button class="btn danger" data-del="${t.id}">Retirar</button>
      </td>
    </tr>
  `).join('')
}

function renderRecurring() {
  const list = monthTx()
  const paint = (el, items) => {
    if (!items.length) {
      el.innerHTML = '<li class="muted">Nada por aqui ainda.</li>'
      return
    }
    el.innerHTML = items.map((t, i) => `
      <li style="--i:${i}">
        <div>
          <strong>${t.description}</strong>
          <div class="muted">${accountById(t.accountId)?.name || '-'} · ${t.category} · ${PAYMENT_LABELS[t.paymentMethod]} · ${money(t.amount)}</div>
        </div>
        <div>
          <button class="btn btn-ghost" data-edit="${t.id}">Editar</button>
          <button class="btn danger" data-del="${t.id}">Retirar</button>
        </div>
      </li>
    `).join('')
  }
  paint($('#fixedList'), list.filter((t) => t.recurrence === 'fixed'))
  paint($('#variableList'), list.filter((t) => t.recurrence === 'variable'))
}

function renderAccounts() {
  const accounts = profileAccounts()
  const el = $('#accountList')
  if (!accounts.length) {
    el.innerHTML = '<li class="muted">Nenhuma conta neste perfil.</li>'
    return
  }
  el.innerHTML = accounts.map((a, i) => {
    const t = totals(accountTx(a.id))
    return `
      <li style="--i:${i}">
        <div>
          <strong>${a.name}</strong>
          <div class="muted">${a.bank} · ${ACCOUNT_TYPE_LABELS[a.type] || a.type} · saldo ${money(t.profit)}</div>
        </div>
        <div>
          <button class="btn btn-ghost" data-filter-account="${a.id}">Ver</button>
          ${accounts.length > 1 ? `<button class="btn danger" data-remove-account="${a.id}">Retirar</button>` : ''}
        </div>
      </li>
    `
  }).join('')
}

function renderProfiles() {
  $('#profileList').innerHTML = state.profiles.map((p, i) => {
    const nAcc = state.accounts.filter((a) => a.profileId === p.id).length
    return `
      <li style="--i:${i}">
        <div>
          <strong style="color:${p.color}">${p.name}</strong>
          <div class="muted">Meta ${money(p.goal)} · ${nAcc} conta(s)</div>
        </div>
        <div>
          <button class="btn btn-ghost" data-activate="${p.id}">Usar</button>
          ${state.profiles.length > 1 ? `<button class="btn danger" data-remove-profile="${p.id}">Retirar</button>` : ''}
        </div>
      </li>
    `
  }).join('')
}

function renderReport() {
  const t = totals()
  const profile = activeProfile()
  const accounts = profileAccounts()
  $('#reportPreview').innerHTML = `
    <p><strong>Perfil:</strong> ${profile.name}</p>
    <p><strong>Mes:</strong> ${monthLabel(month)}</p>
    <p><strong>Saldo acumulado:</strong> ${money(totals(allTx()).profit)}</p>
    <p><strong>Receitas:</strong> ${money(t.income)}</p>
    <p><strong>Despesas:</strong> ${money(t.expense)}</p>
    <p><strong>Lucro:</strong> ${money(t.profit)}</p>
    <p><strong>Meta:</strong> ${money(profile.goal)} (${profile.goal ? ((t.profit / profile.goal) * 100).toFixed(0) : 0}%)</p>
    ${accounts.map((a) => `<p><strong>${a.name}:</strong> ${money(totals(accountTx(a.id)).profit)}</p>`).join('')}
  `
}

function renderAll() {
  fillProfiles()
  fillAccountSelects()
  renderKpis()
  renderAccountStrip()
  renderCharts()
  renderTable()
  renderRecurring()
  renderAccounts()
  renderProfiles()
  renderReport()
}

function openTx(tx) {
  ensureAccount()
  fillAccountSelects()
  const form = $('#txForm')
  $('#txDialogTitle').textContent = tx ? 'Editar lancamento' : 'Novo lancamento'
  form.reset()
  form.id.value = tx?.id || ''
  form.date.value = tx?.date || todayISO()
  form.type.value = tx?.type || 'expense'
  fillCategories(form.category, form.type.value)
  form.description.value = tx?.description || ''
  form.category.value = tx?.category || form.category.options[0]?.value
  form.amount.value = tx?.amount || ''
  form.paymentMethod.value = tx?.paymentMethod || 'pix'
  form.recurrence.value = tx?.recurrence || 'variable'
  form.accountId.value = tx?.accountId || (accountFilter !== 'all' ? accountFilter : profileAccounts()[0]?.id)
  $('#txDialog').showModal()
}

function exportPdf() {
  const profile = activeProfile()
  const t = totals()
  const life = totals(allTx())
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const generatedAt = new Date().toLocaleString('pt-BR')

  const C = {
    green: [171, 224, 84],
    orange: [250, 85, 60],
    purple: [191, 90, 242],
    black: [5, 5, 6],
    offwhite: [245, 242, 234],
    muted: [120, 118, 112],
    line: [230, 226, 216]
  }

  const tableTheme = {
    margin: { top: 32, bottom: 22, left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: C.black,
      lineColor: C.line,
      lineWidth: 0.15,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: C.black,
      textColor: C.green,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3.4
    },
    alternateRowStyles: { fillColor: C.offwhite },
    bodyStyles: { fillColor: [255, 255, 255] }
  }

  const nextTableY = () => (doc.lastAutoTable?.finalY || 96) + 10

  const paintChrome = () => {
    const total = doc.internal.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)

      doc.setFillColor(...C.black)
      doc.rect(0, 0, pageW, 24, 'F')
      doc.setFillColor(...C.orange)
      doc.rect(0, 0, 3.4, 24, 'F')
      doc.setFillColor(...C.green)
      doc.rect(0, 24, pageW, 2.2, 'F')
      doc.setFillColor(...C.purple)
      doc.rect(pageW - 16, 0, 16, 24, 'F')

      doc.setTextColor(...C.offwhite)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('@virecmg', 10, 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...C.green)
      doc.text('Controle Financeiro Pessoal', 10, 16.5)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...C.offwhite)
      doc.text(profile.name, pageW - 20, 10, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Relatorio ${monthLabel(month)}`, pageW - 20, 16.5, { align: 'right' })

      doc.setFillColor(...C.black)
      doc.rect(0, pageH - 16, pageW, 16, 'F')
      doc.setFillColor(...C.orange)
      doc.rect(0, pageH - 16, pageW, 1.6, 'F')
      doc.setFillColor(...C.green)
      doc.rect(0, pageH - 14.4, 48, 1.2, 'F')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...C.offwhite)
      doc.text('VIRECMG  ·  Relatorio mensal', 10, pageH - 7)
      doc.setTextColor(...C.green)
      doc.text(`Pagina ${i} de ${total}`, pageW / 2, pageH - 7, { align: 'center' })
      doc.setTextColor(...C.offwhite)
      doc.text(generatedAt, pageW - 10, pageH - 7, { align: 'right' })
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...C.black)
  doc.text('Resumo do mes', 14, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.muted)
  doc.text(`${profile.name}  ·  ${monthLabel(month)}  ·  contas filtradas: ${accountFilter === 'all' ? 'todas' : (accountById(accountFilter)?.name || '-')}`, 14, 42)

  const cards = [
    ['Saldo em conta', money(life.profit), C.offwhite, C.black],
    ['Receitas', money(t.income), C.green, C.black],
    ['Despesas', money(t.expense), C.orange, C.offwhite],
    ['Lucro', money(t.profit), C.black, C.offwhite],
    ['Meta do mes', money(profile.goal), C.purple, C.offwhite]
  ]
  const gap = 4
  const cardW = (pageW - 28 - gap * 4) / 5
  cards.forEach((card, i) => {
    const x = 14 + i * (cardW + gap)
    const y = 48
    doc.setFillColor(...card[2])
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...card[3])
    doc.text(card[0].toUpperCase(), x + 3, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(card[1], x + 3, y + 16)
  })

  autoTable(doc, {
    ...tableTheme,
    startY: 78,
    head: [['Conta', 'Banco', 'Tipo', 'Saldo']],
    body: profileAccounts().map((a) => [
      a.name,
      a.bank,
      ACCOUNT_TYPE_LABELS[a.type] || a.type,
      money(totals(accountTx(a.id)).profit)
    ]),
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
  })

  autoTable(doc, {
    ...tableTheme,
    startY: nextTableY(),
    head: [['Data', 'Descricao', 'Conta', 'Tipo', 'Categoria', 'Forma', 'Valor']],
    body: monthTx().sort((a, b) => a.date.localeCompare(b.date)).map((x) => [
      x.date.split('-').reverse().join('/'),
      x.description,
      accountById(x.accountId)?.name || '-',
      x.type === 'income' ? 'Receita' : 'Despesa',
      x.category,
      PAYMENT_LABELS[x.paymentMethod] || x.paymentMethod,
      money(x.amount)
    ]),
    columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } }
  })

  const expenses = groupBy(monthTx().filter((x) => x.type === 'expense'), 'category')
  const incomes = groupBy(monthTx().filter((x) => x.type === 'income'), 'category')
  autoTable(doc, {
    ...tableTheme,
    startY: nextTableY(),
    head: [['Categoria de despesa', 'Total']],
    body: Object.entries(expenses).map(([k, v]) => [k, money(v)]),
    headStyles: { ...tableTheme.headStyles, textColor: C.orange },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  })
  autoTable(doc, {
    ...tableTheme,
    startY: nextTableY(),
    head: [['Categoria de entrada', 'Total']],
    body: Object.entries(incomes).map(([k, v]) => [k, money(v)]),
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  })

  paintChrome()
  doc.save(`virecmg-${profile.name}-${month}.pdf`)
}

function splitCsvLine(line, sep) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out.map((x) => x.replace(/^"|"$/g, ''))
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r/g, '')
  const lines = clean.split('\n').filter((l) => l.trim())
  if (!lines.length) return []
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','
  const headers = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  const idx = (names) => names.map((n) => headers.findIndex((h) => h.includes(n))).find((i) => i >= 0)
  const iDate = idx(['data', 'date', 'dt'])
  const iDesc = idx(['descricao', 'historico', 'memo', 'description', 'titulo'])
  const iType = idx(['tipo', 'type', 'natureza', 'dc'])
  const iCat = idx(['categoria', 'category', 'classificacao'])
  const iVal = idx(['valor', 'amount', 'value'])
  const iPay = idx(['pagamento', 'forma', 'payment', 'metodo'])
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, sep)
    const amountRaw = parseAmount(cols[iVal] ?? cols[cols.length - 1])
    const type = detectType(cols[iType], amountRaw)
    const amount = Math.abs(amountRaw)
    if (!amount) return null
    const payRaw = String(cols[iPay] || '').toLowerCase()
    let paymentMethod = 'pix'
    if (payRaw.includes('cred')) paymentMethod = 'credit'
    else if (payRaw.includes('deb')) paymentMethod = 'debit'
    else if (payRaw.includes('boleto')) paymentMethod = 'boleto'
    else if (payRaw.includes('dinheiro') || payRaw.includes('cash')) paymentMethod = 'cash'
    else if (payRaw.includes('ted') || payRaw.includes('transf')) paymentMethod = 'transfer'
    return {
      date: parseDate(cols[iDate] || todayISO()),
      description: cols[iDesc] || 'Lancamento importado',
      type,
      category: cols[iCat] || 'Outros',
      amount,
      paymentMethod,
      recurrence: 'variable'
    }
  }).filter(Boolean)
}

function importRows(rows) {
  const account = accountFilter !== 'all' ? accountById(accountFilter) : ensureAccount()
  rows.forEach((row) => {
    state.transactions.push({
      id: uid(),
      profileId: state.activeProfileId,
      accountId: account.id,
      ...row
    })
  })
  save()
  renderAll()
  $('#importPreview').innerHTML = `<p>${rows.length} lancamentos importados para ${activeProfile().name} / ${account.name}.</p>`
}

function bind() {
  $('#monthPicker').value = month
  fillCategories($('#txForm').category, 'expense')
  chartDefaults()

  $$('[data-view]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      if (btn.dataset.view) setView(btn.dataset.view)
    })
  })

  $('#menuBtn').addEventListener('click', () => $('#drawer').classList.toggle('open'))

  $('#profileSelect').addEventListener('change', (e) => {
    state.activeProfileId = e.target.value
    accountFilter = 'all'
    save()
    renderAll()
  })
  $('#accountFilter').addEventListener('change', (e) => {
    accountFilter = e.target.value
    renderAll()
  })
  $('#monthPicker').addEventListener('change', (e) => {
    month = e.target.value || currentMonth()
    renderAll()
  })
  $('#btnNewTx').addEventListener('click', () => openTx(null))
  $('#txCancel').addEventListener('click', () => $('#txDialog').close())
  $('#txForm').type.addEventListener('change', (e) => fillCategories($('#txForm').category, e.target.value))
  $('#txForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    const payload = {
      id: f.id.value || uid(),
      profileId: state.activeProfileId,
      accountId: f.accountId.value || ensureAccount().id,
      date: f.date.value,
      description: f.description.value.trim(),
      type: f.type.value,
      category: f.category.value,
      amount: parseAmount(f.amount.value),
      paymentMethod: f.paymentMethod.value,
      recurrence: f.recurrence.value
    }
    const idx = state.transactions.findIndex((t) => t.id === payload.id)
    if (idx >= 0) state.transactions[idx] = payload
    else state.transactions.push(payload)
    save()
    $('#txDialog').close()
    renderAll()
  })

  document.body.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]')
    const del = e.target.closest('[data-del]')
    const act = e.target.closest('[data-activate]')
    const rm = e.target.closest('[data-remove-profile]')
    const rmAcc = e.target.closest('[data-remove-account]')
    const filterAcc = e.target.closest('[data-filter-account]')
    if (edit) {
      const tx = state.transactions.find((t) => t.id === edit.dataset.edit)
      if (tx) openTx(tx)
    }
    if (del) {
      state.transactions = state.transactions.filter((t) => t.id !== del.dataset.del)
      save()
      renderAll()
    }
    if (act) {
      state.activeProfileId = act.dataset.activate
      accountFilter = 'all'
      save()
      renderAll()
      setView('dashboard')
    }
    if (rm) {
      if (state.profiles.length <= 1) return
      const id = rm.dataset.removeProfile
      state.profiles = state.profiles.filter((p) => p.id !== id)
      state.accounts = state.accounts.filter((a) => a.profileId !== id)
      state.transactions = state.transactions.filter((t) => t.profileId !== id)
      if (state.activeProfileId === id) state.activeProfileId = state.profiles[0].id
      accountFilter = 'all'
      save()
      renderAll()
    }
    if (rmAcc) {
      const id = rmAcc.dataset.removeAccount
      if (profileAccounts().length <= 1) return
      state.accounts = state.accounts.filter((a) => a.id !== id)
      state.transactions = state.transactions.filter((t) => t.accountId !== id)
      if (accountFilter === id) accountFilter = 'all'
      save()
      renderAll()
    }
    if (filterAcc) {
      accountFilter = filterAcc.dataset.filterAccount
      $('#accountFilter').value = accountFilter
      renderAll()
      setView('dashboard')
    }
  })

  $('#txSearch').addEventListener('input', renderTable)
  $('#txTypeFilter').addEventListener('change', renderTable)
  $('#txPayFilter').addEventListener('change', renderTable)
  $('#btnExportPdf').addEventListener('click', exportPdf)
  $('#btnExportPdf2').addEventListener('click', exportPdf)

  $('#profileForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    const profile = {
      id: uid(),
      name: f.name.value.trim(),
      goal: parseAmount(f.goal.value),
      color: f.color.value
    }
    state.profiles.push(profile)
    state.accounts.push({
      id: uid(),
      profileId: profile.id,
      name: 'Carteira',
      bank: 'Dinheiro',
      type: 'wallet'
    })
    state.activeProfileId = profile.id
    accountFilter = 'all'
    save()
    f.reset()
    renderAll()
  })

  $('#accountForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    state.accounts.push({
      id: uid(),
      profileId: state.activeProfileId,
      name: f.name.value.trim(),
      bank: f.bank.value.trim(),
      type: f.type.value
    })
    save()
    f.reset()
    renderAll()
  })

  const file = $('#csvFile')
  const zone = $('#dropzone')
  const handleFile = async (f) => {
    const text = await f.text()
    const rows = parseCsv(text)
    if (!rows.length) {
      $('#importPreview').innerHTML = '<p>Nao foi possivel ler o arquivo. Use colunas data, descricao, tipo, categoria e valor.</p>'
      return
    }
    $('#importPreview').innerHTML = `
      <p>${rows.length} linhas detectadas. Preview:</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Descricao</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead>
          <tbody>
            ${rows.slice(0, 8).map((r, i) => `<tr style="--i:${i}"><td>${r.date}</td><td>${r.description}</td><td>${r.type}</td><td>${r.category}</td><td>${money(r.amount)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button class="btn btn-light" id="confirmImport">Confirmar importacao</button>
    `
    $('#confirmImport').onclick = () => importRows(rows)
  }
  file.addEventListener('change', () => file.files[0] && handleFile(file.files[0]))
  zone.addEventListener('dragover', (e) => e.preventDefault())
  zone.addEventListener('drop', (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  })
}

bind()
renderAll()
