const supabaseUrl = 'https://vrfmghmdwbsadgovljoc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZm1naG1kd2JzYWRnb3Zsam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjM5MDUsImV4cCI6MjA4OTM5OTkwNX0.P-7nx1l0C-pGjJTMUOdeeYH-MQ1WNtz1_Ed6F0mqkWA';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

class AppStore {
    constructor() {
        this.items = [];
        this.categories = [];
    }

    async init() {
        await Promise.all([
            this.fetchCategories(),
            this.fetchItems()
        ]);
    }

    async fetchCategories() {
        const { data, error } = await supabase.from('categories').select('*');
        if (data) this.categories = data.map(c => c.name);
    }

    async fetchItems() {
        // Order by created time loosely by ordering by ID 
        const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
        if (data) Object.assign(this.items, data);
    }

    async addItem(item) {
        const { error } = await supabase.from('items').insert([item]);
        if (!error) this.items.unshift(item);
        else console.error("Error adding item", error);
    }

    async addCategory(catName) {
        if (!this.categories.includes(catName)) {
            const { error } = await supabase.from('categories').insert([{ name: catName }]);
            if (!error) this.categories.push(catName);
        }
    }

    async updateStates(ids, newState, borrowInfo = null) {
        const { error } = await supabase
            .from('items')
            .update({ state: newState, borrowInfo: borrowInfo })
            .in('id', ids);
            
        if (!error) {
            this.items = this.items.map(item => {
                if (ids.includes(item.id)) {
                    item.state = newState;
                    item.borrowInfo = borrowInfo;
                }
                return item;
            });
        }
    }

    async deleteItem(id) {
        const { error } = await supabase.from('items').delete().eq('id', id);
        if (!error) {
            this.items = this.items.filter(i => i.id !== id);
        }
    }

    async updateItem(item) {
        const { error } = await supabase.from('items').update(item).eq('id', item.id);
        if (!error) {
            this.items = this.items.map(i => i.id === item.id ? item : i);
        }
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', async () => {
    // -- AUTHENTICATION LOGIC --
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');

    if (localStorage.getItem('apex_auth') === 'true') {
        loginOverlay.classList.add('hidden');
    } else {
        loginPassword.focus();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (loginPassword.value === 'matos42') {
            localStorage.setItem('apex_auth', 'true');
            loginOverlay.classList.add('hidden');
            loginError.style.display = 'none';
        } else {
            loginError.style.display = 'block';
            loginPassword.value = '';
            loginPassword.focus();
        }
    });

    // DOM Elements
    const grid = document.getElementById('inventoryGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryChips = document.getElementById('categoryChips');
    let selectedCategories = new Set();
    const selectionBar = document.getElementById('selectionBar');
    const selectionCount = document.getElementById('selectionCount');
    
    // Modals
    const modalAdd = document.getElementById('modalAdd');
    const modalBorrow = document.getElementById('modalBorrow');
    const modalEdit = document.getElementById('modalEdit');

    // Add New Modal Elements
    const btnAddNew = document.getElementById('btnAddNew');
    const formAdd = document.getElementById('formAdd');
    const addCatSelector = document.getElementById('addCategorySelector');
    const btnNewDocCat = document.getElementById('btnNewDocCat');
    const addNewCategory = document.getElementById('addNewCategory');

    // Edit Modal Elements
    const formEdit = document.getElementById('formEdit');
    const editCategorySelector = document.getElementById('editCategorySelector');

    // Borrow / Return Elements
    const btnBorrowSelected = document.getElementById('btnBorrowSelected');
    const formBorrow = document.getElementById('formBorrow');
    const borrowCountLabel = document.getElementById('borrowCountLabel');
    const btnReturnSelected = document.getElementById('btnReturnSelected');

    // Context Menu
    const contextMenu = document.getElementById('contextMenu');
    let rightClickedItemId = null;

    const store = new AppStore();
    let selectedIds = new Set();
    let currentFilter = 'all';

    // Show loading while fetching from DB
    grid.innerHTML = '<div style="text-align:center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);"><span class="material-icons-round" style="font-size: 32px; animation: spin 1s infinite linear;">sync</span><br><br>Chargement depuis Supabase...</div>';
    await store.init();

    // Init App UI
    renderGrid();
    updateCategorySelectors();

    // NAVIGATION
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            nav.classList.add('active');
            
            const view = nav.dataset.view;
            if (view === 'inventory') {
                currentFilter = 'all';
            } else if (view === 'loans') {
                currentFilter = 'emprunte';
            } else {
                currentFilter = 'all';
            }
            
            selectedIds.clear();
            updateSelectionBar();
            renderGrid(searchInput.value);
        });
    });

    // RENDERING
    function getStatusConfig(state) {
        const conf = {
            'dispo': { text: 'Disponible', class: 'status-dispo' },
            'HS': { text: 'Hors Service', class: 'status-HS' },
            'emprunte': { text: 'Emprunté', class: 'status-emprunte' },
            'non_empruntable': { text: 'Non Empruntable', class: 'status-non_empruntable' }
        };
        return conf[state] || conf['dispo'];
    }

    function renderGrid(query = '') {
        grid.innerHTML = '';
        const lowerQuery = query.toLowerCase();
        
        let filtered = store.items.filter(i => 
            (i.name.toLowerCase().includes(lowerQuery) || i.code.toLowerCase().includes(lowerQuery))
        );

        if (selectedCategories.size > 0) {
            filtered = filtered.filter(i => selectedCategories.has(i.category));
        }

        if (currentFilter === 'emprunte') {
            filtered = filtered.filter(i => i.state === 'emprunte');
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1/-1; color: var(--text-secondary); padding: 40px;">Aucun élément trouvé.</div>`;
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = `item-card glass-panel ${selectedIds.has(item.id) ? 'selected' : ''}`;
            card.dataset.id = item.id;
            
            const conf = getStatusConfig(item.state);
            
            let borrowHTML = '';
            if (item.state === 'emprunte' && item.borrowInfo) {
                borrowHTML = `
                    <div class="borrow-info">
                        Emprunté par <strong>${item.borrowInfo.firstName} ${item.borrowInfo.lastName}</strong><br>
                        Retour: <strong>${item.borrowInfo.date}</strong>
                        ${item.borrowInfo.reason ? `<br><span style="opacity: 0.8; font-size: 0.8rem;">${item.borrowInfo.reason}</span>` : ''}
                    </div>`;
            }

            card.innerHTML = `
                <div class="item-header">
                    <span class="item-category">${item.category}</span>
                </div>
                <div class="item-title">${item.name}</div>
                <div class="item-code">${item.code}</div>
                <div class="item-status ${conf.class}">
                    <div class="status-dot"></div> ${conf.text}
                </div>
                ${borrowHTML}
            `;

            // Selection Logic
            card.addEventListener('click', () => {
                if (item.state === 'dispo' || item.state === 'emprunte') {
                    if (selectedIds.has(item.id)) {
                        selectedIds.delete(item.id);
                        card.classList.remove('selected');
                    } else {
                        const hasOtherStates = Array.from(selectedIds).some(id => store.items.find(i => i.id === id).state !== item.state);
                        if(hasOtherStates) {
                            alert("Veuillez sélectionner uniquement des éléments du même statut pour l'action groupée.");
                            return;
                        }
                        selectedIds.add(item.id);
                        card.classList.add('selected');
                    }
                    updateSelectionBar();
                }
            });

            // Right Click Logic
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                rightClickedItemId = item.id;
                
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');
                
                const rect = contextMenu.getBoundingClientRect();
                if (rect.right > window.innerWidth) contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
                if (rect.bottom > window.innerHeight) contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            });

            grid.appendChild(card);
        });
    }

    function updateSelectionBar() {
        if (selectedIds.size > 0) {
            selectionBar.classList.add('active');
            selectionCount.textContent = `${selectedIds.size} élément(s) sélectionné(s)`;
            
            const sampleId = Array.from(selectedIds)[0];
            const sampleItem = store.items.find(i => i.id === sampleId);
            
            if (sampleItem && sampleItem.state === 'dispo') {
                btnBorrowSelected.style.display = 'flex';
                btnReturnSelected.style.display = 'none';
            } else if (sampleItem && sampleItem.state === 'emprunte') {
                btnBorrowSelected.style.display = 'none';
                btnReturnSelected.style.display = 'flex';
            } else {
                btnBorrowSelected.style.display = 'none';
                btnReturnSelected.style.display = 'none';
            }
        } else {
            selectionBar.classList.remove('active');
        }
    }

    // CATEGORY SELECTORS & CHIPS
    function updateCategorySelectors() {
        addCatSelector.innerHTML = '';
        editCategorySelector.innerHTML = '';
        
        store.categories.forEach(cat => {
            let op = document.createElement('option');
            op.value = cat;
            op.textContent = cat;
            addCatSelector.appendChild(op);
            
            let opEdit = document.createElement('option');
            opEdit.value = cat;
            opEdit.textContent = cat;
            editCategorySelector.appendChild(opEdit);
        });

        // Update chips
        categoryChips.innerHTML = '';
        
        const allChip = document.createElement('div');
        allChip.className = `chip ${selectedCategories.size === 0 ? 'active' : ''}`;
        allChip.textContent = 'Toutes';
        allChip.addEventListener('click', () => {
            selectedCategories.clear();
            updateChipsUI();
            renderGrid(searchInput.value);
        });
        categoryChips.appendChild(allChip);

        store.categories.forEach(cat => {
            const chip = document.createElement('div');
            chip.className = `chip ${selectedCategories.has(cat) ? 'active' : ''}`;
            chip.textContent = cat;
            chip.addEventListener('click', () => {
                if (selectedCategories.has(cat)) selectedCategories.delete(cat);
                else selectedCategories.add(cat);
                updateChipsUI();
                renderGrid(searchInput.value);
            });
            categoryChips.appendChild(chip);
        });
    }

    function updateChipsUI() {
        if (!categoryChips) return;
        const chips = categoryChips.children;
        if (chips.length === 0) return;
        
        if (selectedCategories.size === 0) {
            chips[0].classList.add('active');
            for(let i=1; i<chips.length; i++) chips[i].classList.remove('active');
        } else {
            chips[0].classList.remove('active');
            for(let i=1; i<chips.length; i++) {
                const cat = chips[i].textContent;
                if (selectedCategories.has(cat)) chips[i].classList.add('active');
                else chips[i].classList.remove('active');
            }
        }
    }

    // ADD ITEM
    btnAddNew.addEventListener('click', () => {
        document.getElementById('addName').focus();
        modalAdd.classList.add('active');
    });
    
    btnNewDocCat.addEventListener('click', () => {
        addCatSelector.classList.toggle('hidden');
        addNewCategory.classList.toggle('hidden');
        if(!addNewCategory.classList.contains('hidden')) {
            addNewCategory.focus();
        }
    });

    formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = formAdd.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enregistrement...';

        try {
            let category = addCatSelector.value;
            if (!addNewCategory.classList.contains('hidden')) {
                category = addNewCategory.value.trim();
                if(category) {
                    await store.addCategory(category);
                    updateCategorySelectors();
                }
            }

            const quantity = parseInt(document.getElementById('addQuantity').value, 10) || 1;
            const baseName = document.getElementById('addName').value;
            const baseCode = document.getElementById('addCode').value;
            const state = document.getElementById('addState').value;
            
            for (let i = 0; i < quantity; i++) {
                const suffix = quantity > 1 ? `-${i+1}` : '';
                const newItem = {
                    id: Date.now().toString() + '-' + i,
                    name: quantity > 1 ? `${baseName} ${i+1}` : baseName,
                    code: `${baseCode}${suffix}`,
                    category: category,
                    state: state,
                    borrowInfo: null
                };
                await store.addItem(newItem);
            }
            
            modalAdd.classList.remove('active');
            formAdd.reset();
            addCatSelector.classList.remove('hidden');
            addNewCategory.classList.add('hidden');
            
            if (currentFilter !== 'all') {
                document.querySelector('[data-view="inventory"]').click();
            } else {
                renderGrid(searchInput.value);
            }
        } catch (err) {
            console.error(err);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Ajouter à l\'inventaire';
        }
    });

    // EDIT ITEM
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = formEdit.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enregistrement...';

        try {
            const updatedItem = {
                id: rightClickedItemId,
                name: document.getElementById('editName').value,
                code: document.getElementById('editCode').value,
                category: editCategorySelector.value
            };

            const existingItem = store.items.find(i => i.id === rightClickedItemId);
            const finalItem = { ...existingItem, ...updatedItem };

            await store.updateItem(finalItem);

            modalEdit.classList.remove('active');
            renderGrid(searchInput.value);
        } catch(err) {
            console.error(err);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enregistrer les modifications';
        }
    });

    // BORROW
    btnBorrowSelected.addEventListener('click', () => {
        borrowCountLabel.textContent = selectedIds.size;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7);
        document.getElementById('borrowReturnDate').valueAsDate = targetDate;
        
        modalBorrow.classList.add('active');
        document.getElementById('borrowFirstName').focus();
    });

    formBorrow.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = formBorrow.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Exécution...';

        try {
            const info = {
                firstName: document.getElementById('borrowFirstName').value,
                lastName: document.getElementById('borrowLastName').value,
                date: document.getElementById('borrowReturnDate').value,
                reason: document.getElementById('borrowReason').value
            };

            await store.updateStates(Array.from(selectedIds), 'emprunte', info);
            
            selectedIds.clear();
            modalBorrow.classList.remove('active');
            formBorrow.reset();
            
            updateSelectionBar();
            renderGrid(searchInput.value);
        } catch (err) {
            console.error(err);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Confirmer l\'emprunt';
        }
    });

    // RETURN
    btnReturnSelected.addEventListener('click', async () => {
        if(confirm(`Êtes-vous sûr de notifier le retour de ces ${selectedIds.size} matériel(s) et les rendre de nouveau Disponibles ?`)) {
            const btn = document.getElementById('btnReturnSelected');
            const originalText = btn.textContent;
            btn.textContent = 'En cours...';
            btn.disabled = true;

            try {
                await store.updateStates(Array.from(selectedIds), 'dispo', null);
                selectedIds.clear();
                updateSelectionBar();
                renderGrid(searchInput.value);
            } catch (err) {
                console.error(err);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    });

    // SEARCH & UTILS
    searchInput.addEventListener('input', (e) => renderGrid(e.target.value));
    
    document.getElementById('btnClearSelection').addEventListener('click', () => {
        selectedIds.clear();
        renderGrid(searchInput.value);
        updateSelectionBar();
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalAdd.classList.remove('active');
            modalBorrow.classList.remove('active');
            modalEdit.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) {
                modalAdd.classList.remove('active');
                modalBorrow.classList.remove('active');
                modalEdit.classList.remove('active');
            }
        });
    });

    // CONTEXT MENU EVENTS
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
        }
    });

    contextMenu.addEventListener('click', async (e) => {
        e.stopPropagation();
        const actionItem = e.target.closest('.menu-item');
        if (!actionItem || !rightClickedItemId) return;
        
        contextMenu.classList.add('hidden');
        const action = actionItem.dataset.action;
        
        if (action === 'edit') {
            const itemToEdit = store.items.find(i => i.id === rightClickedItemId);
            if (itemToEdit) {
                document.getElementById('editName').value = itemToEdit.name;
                document.getElementById('editCode').value = itemToEdit.code;
                editCategorySelector.value = itemToEdit.category;
                modalEdit.classList.add('active');
            }
        } else if (action === 'delete') {
            if(confirm('Êtes-vous sûr de vouloir supprimer définitivement ce matériel ?')) {
                await store.deleteItem(rightClickedItemId);
                selectedIds.delete(rightClickedItemId);
                updateSelectionBar();
                renderGrid(searchInput.value);
            }
        } else if (action.startsWith('state-')) {
            const newState = action.split('state-')[1];
            await store.updateStates([rightClickedItemId], newState, null);
            selectedIds.delete(rightClickedItemId);
            updateSelectionBar();
            renderGrid(searchInput.value);
        }
    });
});
