'use strict';

import { getTodosFromStorage, saveTodosToStorage, removeTodoFromStorage } from './todo-storage.js';
import { loadTodos } from './todo-load.js';
import { logVerbose } from './todo-logging.js';

// Toggle completion status of a todo item
export function toggleTodoCompletion(listItem) {
  const id = listItem.data('id');
  const todoList = $('#todo-list');
  logVerbose(`Toggling completion for todo ID: ${id}`);

  const todos = getTodosFromStorage();
  const todoIndex = todos.findIndex(t => t.id === id);

  if (todoIndex !== -1) {
    const todoText = todos[todoIndex].text;
    const item = new jsTodoTxt.Item(todoText);

    if (item.complete()) {
      item.setComplete(false);
      item.setCompleted(null); // Clear completion date
    } else {
      item.setComplete(true);
      item.setCompleted(new Date()); // Set completion date to now
    }

    todos[todoIndex].text = item.toString();
    saveTodosToStorage(todos);
    loadTodos(todoList);
  } else {
    console.error(`Todo with ID ${id} not found.`);
  }
}

// Start editing a todo item
export function startEditTodo(listItem) {
  const id = listItem.data('id');
  const addButton = $('#addButton');
  const todoInput = $('#todoInput');
  const prioritySelect = $('#prioritySelect');
  const projectSelect = $('#projectSelect');
  const contextSelect = $('#contextSelect');

  logVerbose(`Starting edit for todo ID: ${id}`);

  const todos = getTodosFromStorage();
  const todo = todos.find(t => t.id === id);

  if (todo) {
    const item = new jsTodoTxt.Item(todo.text);

    // Populate Input Field
    // We want to show the 'body' of the todo (text without priority/dates/projects/contexts if we are using dropdowns for those)
    // BUT, the original app seems to have a mix.
    // Simpler approach for now: Put the stripped text in the input, and set dropdowns.
    // CAUTION: jsTodoTxt.Item.text() returns the text body *excluding* priority and completion mark,
    // but *including* projects/contexts/dates if they are in the body.
    // Let's use the raw text for now or try to parse components.

    // A better user experience might be to populate the input with the Description only,
    // and set the dropdowns/datepickers.
    // However, jsTodoTxt doesn't perfectly separate "description" from "extensions" in all getters.
    // Let's rely on what we can extract.

    // 1. Priority
    const priority = item.priority();
    if (priority) {
        // Set the hidden input value
        prioritySelect.val(priority);
        // Update the button text to show selected priority
        const priorityLink = $(`#priorityDropdownMenu a[data-value="${priority}"]`);
        if (priorityLink.length) {
            $('#priorityDropdownButton').text(priorityLink.text());
        }
    } else {
        prioritySelect.val('');
        $('#priorityDropdownButton').text('Priority');
    }

    // 2. Creation Date
    const createdDate = item.created();
    if (createdDate) {
       // Format YYYY-MM-DD to DD.MM.YYYY for the picker
       const [year, month, day] = createdDate.toISOString().split('T')[0].split('-');
       $('#createdDate').val(`${day}.${month}.${year}`);
       $('.datepicker-left').datepicker('update', `${day}.${month}.${year}`); // Update picker UI
    } else {
        $('#createdDate').val('');
        $('.datepicker-left').datepicker('update', '');
    }

    // 3. Due Date (Extension)
    // extensions() returns array of {key, value}
    const dueExtension = item.extensions().find(ext => ext.key === 'due');
    if (dueExtension) {
        // Format YYYY-MM-DD to DD.MM.YYYY
        const [year, month, day] = dueExtension.value.split('-');
        $('#dueDate').val(`${day}.${month}.${year}`);
        $('.datepicker-right').datepicker('update', `${day}.${month}.${year}`);
    } else {
        $('#dueDate').val('');
        $('.datepicker-right').datepicker('update', '');
    }

    // 4. Projects & Contexts
    // This is tricky because an item can have multiple. The UI dropdowns seem to support single selection for adding?
    // If we select one, what happens to others?
    // Current UI seems to append.
    // Let's just pick the first one found to populate the dropdown "state", but keep the text in the input?
    // No, standard behavior for these forms is usually: strip metadata from text, put metadata in controls.

    // Let's just put the *cleaned* text (no priority, no dates, no completed) in the input.
    // We might leave projects/contexts in the text if the dropdowns are just "helpers" to append.
    // Re-reading `todo.js` logic for ADD: it appends dropdown values.
    // So for EDIT, we should probably remove them from the text if we set them in dropdowns, OR just leave them in text and clear dropdowns.
    // SIMPLIFIED EDITING: Clear dropdowns, put EVERYTHING in the text input (except maybe priority/dates which have dedicated controls).
    // ACTUALLY, sticking to the existing pattern:
    // The `addTodo` handler constructs the item from Dropdowns + Input.
    // So we should try to extract Priority/Dates to controls, and leave the rest in Input.

    // Remove Priority, Created Date, Completed mark from the string we put in input.
    // We also need to remove the `due:YYYY-MM-DD` string.
    let textForInput = todo.text;

    // Remove completion x and date (if valid)
    textForInput = textForInput.replace(/^x \d{4}-\d{2}-\d{2} /, '').replace(/^x /, '');

    // Remove Priority (e.g. (A) )
    textForInput = textForInput.replace(/^\([A-Z]\) /, '');

    // Remove Creation Date (YYYY-MM-DD ) - strictly at start (after priority removal)
    textForInput = textForInput.replace(/^\d{4}-\d{2}-\d{2} /, '');

    // Remove Due Date (due:YYYY-MM-DD) - anywhere
    textForInput = textForInput.replace(/ due:\d{4}-\d{2}-\d{2}/g, '');

    // Remove Threshold Date (t:YYYY-MM-DD) - anywhere (if we had a picker for it, but we don't visible in UI? We assume hidden or manual)
    // The previous edit logic didn't seem to handle 't:'. Let's leave it in text if present.

    // Projects and Contexts:
    // If we extract them to dropdowns, we should remove them from text.
    // But the dropdowns are single-select. The item might have multiple.
    // strategy: leave them in the text. Reset dropdowns to default.
    // This allows the user to edit them in the text field freely.
    projectSelect.val('');
    $('#projectDropdownButton').text('Project');
    contextSelect.val('');
    $('#contextDropdownButton').text('Context');

    todoInput.val(textForInput);

    // Change "Add Todo" button to "Save Edit"
    addButton.text('Save Edit');
    addButton.data('editingId', id); // Store the ID being edited on the button

    // Scroll to top or input area
    $('html, body').animate({ scrollTop: 0 }, 'fast');
    todoInput.focus();

  } else {
    console.error(`Todo with ID ${id} not found for editing.`);
  }
}

// Delete a todo item
export function deleteTodoItem(listItem) {
  const id = listItem.data('id');
  const todoList = $('#todo-list');
  logVerbose(`Deleting todo ID: ${id}`);

  // Optimistic UI update (remove immediately)
  // listItem.remove(); // Removed to rely on full reload for consistency

  removeTodoFromStorage(id);
  loadTodos(todoList);
}
