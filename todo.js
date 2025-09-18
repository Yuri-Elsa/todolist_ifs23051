let todos = [];
let filter = "all";
let searchQuery = "";
const STORAGE_KEY = "todos_v2";
let historyStack = []; // untuk undo

// --- Custom Alert ---
function showAlert(message, type = "danger") {
  const alertBox = document.getElementById("customAlert");
  alertBox.textContent = message;

  alertBox.className = "custom-alert " + type;
  alertBox.classList.add("show");

  setTimeout(() => {
    alertBox.classList.remove("show");
  }, 3000);
}

// --- Custom Confirm ---
function showConfirm(message, onConfirm) {
  const confirmBox = document.getElementById("customConfirm");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");

  confirmMessage.textContent = message;
  confirmBox.style.display = "flex";

  function cleanup() {
    confirmBox.style.display = "none";
    confirmYes.removeEventListener("click", yesHandler);
    confirmNo.removeEventListener("click", noHandler);
  }
  function yesHandler() {
    cleanup();
    onConfirm();
  }
  function noHandler() {
    cleanup();
  }

  confirmYes.addEventListener("click", yesHandler);
  confirmNo.addEventListener("click", noHandler);
}

// --- Helpers ---
function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}
function loadTodos() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) todos = JSON.parse(raw);
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function pushHistory() {
  historyStack.push(JSON.stringify(todos));
  if (historyStack.length > 50) historyStack.shift();
  document.getElementById("undoBtn").disabled = false;
}
function undo() {
  if (historyStack.length === 0) return;
  todos = JSON.parse(historyStack.pop());
  saveTodos();
  renderTodos();
  if (historyStack.length === 0) {
    document.getElementById("undoBtn").disabled = true;
  }
  showAlert("Perubahan terakhir dibatalkan!", "success");
}
function isDuplicateTitle(title, idToIgnore = null) {
  const t = title.trim().toLowerCase();
  return todos.some(
    (x) =>
      x.todo.trim().toLowerCase() === t &&
      (idToIgnore == null || x.id !== idToIgnore)
  );
}
function getVisibleTodos() {
  const q = searchQuery.trim().toLowerCase();
  return todos.filter((item) => {
    if (filter === "active" && item.completed) return false;
    if (filter === "completed" && !item.completed) return false;
    if (!q) return true;
    return item.todo.toLowerCase().includes(q);
  });
}

// --- Rendering ---
function renderTodos() {
  const todoList = document.getElementById("todoList");
  todoList.innerHTML = "";

  const visible = getVisibleTodos();
  if (visible.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-group-item text-muted";
    empty.textContent = "Tidak ada todo yang sesuai.";
    todoList.appendChild(empty);
    return;
  }

  visible.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex align-items-center";
    li.setAttribute("draggable", "true");
    li.dataset.id = item.id;

    const handle = document.createElement("span");
    handle.className = "todo-handle";
    handle.innerHTML = '<i class="bi bi-list"></i>';
    li.appendChild(handle);

    const div = document.createElement("div");
    div.className = "flex-fill d-flex align-items-center";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "form-check-input me-2";
    checkbox.checked = item.completed;
    checkbox.addEventListener("change", () => {
      pushHistory();
      item.completed = checkbox.checked;
      saveTodos();
      renderTodos();
      showAlert(
        item.completed ? "Todo ditandai selesai!" : "Todo ditandai aktif!",
        "success"
      );
    });

    const label = document.createElement("span");
    label.className = "me-2 flex-fill";
    label.style.wordBreak = "break-word";
    label.textContent = item.todo;
    if (item.completed) {
      label.style.textDecoration = "line-through";
      label.classList.add("text-muted");
    }

    div.appendChild(checkbox);
    div.appendChild(label);

    // actions
    const btnGroup = document.createElement("div");
    btnGroup.className = "ms-2";

    // edit inline
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-primary me-1"; // ✅ pakai primary
    editBtn.innerHTML = '<i class="bi bi-pencil edit-icon"></i>';
    editBtn.addEventListener("click", () => {
      startInlineEdit(li, item);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-sm btn-danger"; // ✅ pakai danger
    delBtn.innerHTML = '<i class="bi bi-trash delete-icon"></i>';
    delBtn.addEventListener("click", () => {
      showConfirm("Apa kamu yakin ingin menghapus todo ini?", () => {
        pushHistory();
        todos = todos.filter((t) => t.id !== item.id);
        saveTodos();
        renderTodos();
        showAlert("1 todo berhasil dihapus!", "danger");
      });
    });

    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(delBtn);

    li.appendChild(div);
    li.appendChild(btnGroup);

    // drag events
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.id);
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      clearDragOverStyles();
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      clearDragOverStyles();
      li.classList.add("drag-over");
    });
    li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      const targetId = li.dataset.id;
      if (draggedId !== targetId) {
        pushHistory();
        reorderTodos(draggedId, targetId);
        saveTodos();
        renderTodos();
        showAlert("Todo berhasil dipindahkan!", "success");
      }
    });

    todoList.appendChild(li);
  });
}
function clearDragOverStyles() {
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
}
function reorderTodos(draggedId, targetId) {
  const fromIdx = todos.findIndex((t) => t.id === draggedId);
  const toIdx = todos.findIndex((t) => t.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [item] = todos.splice(fromIdx, 1);
  todos.splice(toIdx, 0, item);
}

// --- Inline Edit ---
function startInlineEdit(li, item) {
  const div = li.querySelector(".flex-fill");
  const oldContent = div.innerHTML;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control form-control-sm";
  input.value = item.todo;

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-sm btn-success ms-2"; // ✅ pakai success
  saveBtn.textContent = "Save";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-sm btn-secondary ms-2"; // ✅ pakai secondary
  cancelBtn.textContent = "Cancel";

  div.innerHTML = "";
  div.appendChild(input);
  div.appendChild(saveBtn);
  div.appendChild(cancelBtn);

  input.focus();

  saveBtn.addEventListener("click", () => {
    const newTitle = input.value.trim();
    if (!newTitle) {
      showAlert("Judul tidak boleh kosong", "warning");
      return;
    }
    if (isDuplicateTitle(newTitle, item.id)) {
      showAlert("Judul duplikat dengan todo lain", "danger");
      return;
    }
    pushHistory();
    item.todo = newTitle;
    saveTodos();
    renderTodos();
    showAlert("Todo berhasil diupdate!", "success");
  });

  cancelBtn.addEventListener("click", () => {
    div.innerHTML = oldContent;
    renderTodos();
  });
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  loadTodos();

  const form = document.getElementById("formData");
  const searchInput = document.getElementById("searchInput");
  const filterButtons = document.querySelectorAll("[data-filter]");
  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = form.todo.value.trim();
    if (!value) {
      showAlert("Todo tidak boleh kosong!", "warning");
      return;
    }
    if (isDuplicateTitle(value)) {
      showAlert("Todo sudah ada!", "danger");
      return;
    }
    pushHistory();
    todos.unshift({ id: generateId(), todo: value, completed: false });
    saveTodos();
    renderTodos();
    form.todo.value = "";
    form.todo.focus();
    showAlert("Todo berhasil ditambahkan!", "success");
  });

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTodos();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      setActiveFilterButton();
      renderTodos();
    });
  });

  undoBtn.addEventListener("click", undo);

  clearBtn.addEventListener("click", () => {
    showConfirm("Apa kamu yakin ingin menghapus semua todo?", () => {
      pushHistory();
      todos = [];
      saveTodos();
      renderTodos();
      showAlert("Semua todo telah dihapus!", "danger");
    });
  });

  setActiveFilterButton();
  renderTodos();
});

function setActiveFilterButton() {
  document.querySelectorAll("[data-filter]").forEach((b) => {
    if (b.dataset.filter === filter) {
      b.classList.remove("btn-outline-primary");
      b.classList.add("btn-primary");
    } else {
      b.classList.remove("btn-primary");
      b.classList.add("btn-outline-primary");
    }
  });
}
