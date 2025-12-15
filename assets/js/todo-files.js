/* global jsTodoTxt */
'use strict';

import {
  getKnownFiles,
  getActiveFile,
  setActiveFile,
  removeTodoFromStorage,
  updateTodoInStorage,
  addKnownFile, // Added for setupAddFileModalListeners
  renameKnownFile, // Added for setupRenameFileModalListeners
  removeKnownFile, // Added for delete confirmation handler
  DEFAULT_FILE_PATH, // Added for rename/delete checks
  saveTodosToStorage // Added for setupAddFileModalListeners
} from './todo-storage.js';
import { applyItemStyles } from './todo-ui.js';
import { logVerbose } from './todo-logging.js';
import { loadTodos } from './todo-load.js'; // Added for file switching/deletion

// DOM Elements (assuming they are accessible globally or passed as arguments if needed)
// Consider passing these elements if this module doesn't rely on global $ selectors
const todoInput = $('#todoInput');
const addButton = $('#addButton');
const todoList = $('#todo-list');
const prioritySelect = $('#prioritySelect');
const projectSelect = $('#projectSelect');
const contextSelect = $('#contextSelect');
const fileListSidebar = $('#fileListSidebar'); // New sidebar list element
const currentFileNameHeader = $('#currentFileNameHeader'); // New header element
const addFileForm = $('#addFileForm');
const newFileNameInput = $('#newFileNameInput');
const renameFileForm = $('#renameFileForm');
const newRenameFileNameInput = $('#newRenameFileNameInput');

// Module-level variables for modal instances, initialized lazily
// These might need to be managed differently if modals are created outside this scope
let addFileModalInstance = null;
let renameFileModalInstance = null;

// Helper function to format date from YYYY-MM-DD or Date object to MM/DD/YYYY for datepicker
export function formatDateForPicker(dateInput) {
  if (!dateInput) return '';

  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    // Try parsing YYYY-MM-DD
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      // Note: JS Date constructor month is 0-indexed
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      // Check if the date is valid after parsing
      if (isNaN(date.getTime())) return '';
    } else {
      return ''; // Invalid string format
    }
  } else {
    return ''; // Invalid input type
  }

  let month = '' + (date.getMonth() + 1);
  let day = '' + date.getDate();
  const year = date.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [month, day, year].join('/');
}

// Setup listeners for the Add File modal
export function setupAddFileModalListeners() {
  logVerbose('Setting up Add File modal listeners...');
  addFileForm.off('submit.addfile').on('submit.addfile', async function(event) {
    event.preventDefault();
    const newFileName = newFileNameInput.val();

    if (!newFileName) {
      showNotification("Error: File name cannot be empty.", 'alert');
      return;
    }
    let cleanName = newFileName.trim();
    if (!cleanName) {
      showNotification("Error: File name cannot be empty.", 'alert');
      return;
    }
    if (!cleanName.toLowerCase().endsWith('.txt')) {
      cleanName += '.txt';
      logVerbose(`Appended .txt extension: ${cleanName}`);
    }
    const newFilePath = cleanName.startsWith('/') ? cleanName : `/${cleanName}`;
    const knownFiles = getKnownFiles();
    if (knownFiles.some(file => file.path.toLowerCase() === newFilePath.toLowerCase())) {
      showNotification(`Error: File "${cleanName}" already exists.`, 'alert');
      return;
    }

    logVerbose(`Attempting to add new file: ${newFilePath}`);
    // Get instance here, assuming it's initialized elsewhere before this is called
    const addModalElement = document.getElementById('addFileModal');
    if (addModalElement) {
      addFileModalInstance = bootstrap.Modal.getInstance(addModalElement);
      if (addFileModalInstance) {
        addFileModalInstance.hide();
      }
    }


    try {
      const originalActiveFile = getActiveFile();
      setActiveFile(newFilePath);
      saveTodosToStorage([]);
      setActiveFile(originalActiveFile);
      
      try {
        const { writeGitFile, isGitEnabled } = await import('./git/api.js');
        if (isGitEnabled()) {
          await writeGitFile(cleanName, '', `Create new file: ${cleanName}`);
          logVerbose(`Empty file ${newFilePath} created in Git.`);
        }
      } catch (gitError) {
        logVerbose(`Git sync not available or failed: ${gitError.message}`);
      }
      
      addKnownFile(cleanName, newFilePath);
      setActiveFile(newFilePath);
      updateFileSelectionUI();
      loadTodos(todoList);
      logVerbose(`File "${cleanName}" created successfully.`);
      showNotification(`File "${cleanName}" created successfully.`, 'success');
      
      try {
        const gitSyncModule = await import('./git-sync-coordinator.js');
        if (gitSyncModule && gitSyncModule.coordinateSync) {
          await gitSyncModule.coordinateSync();
        }
      } catch (syncError) {
        logVerbose(`Could not trigger sync: ${syncError.message}`);
      }
    } catch (error) {
      console.error(`Error adding file ${newFilePath}:`, error);
      showNotification(`Failed to add file "${cleanName}". Check console for details.`, 'alert');
    }
  });
  logVerbose('Add File modal listeners attached.');
}

// Setup listeners for the Rename File modal
export function setupRenameFileModalListeners() {
  logVerbose('Setting up Rename File modal listeners...');
  renameFileForm.off('submit.renamefile').on('submit.renamefile', async function(event) {
    event.preventDefault();
    const newFileName = newRenameFileNameInput.val();
    const oldFilePath = getActiveFile();

    if (oldFilePath === DEFAULT_FILE_PATH) {
      showNotification("Error: The default todo.txt file cannot be renamed.", 'alert');
      const renameModalElement = document.getElementById('renameFileModal');
      if (renameModalElement) {
        renameFileModalInstance = bootstrap.Modal.getInstance(renameModalElement);
        if (renameFileModalInstance) renameFileModalInstance.hide();
      }
      return;
    }

    if (!newFileName) {
      showNotification("Error: New file name cannot be empty.", 'alert');
      return;
    }
    let cleanNewName = newFileName.trim();
    if (!cleanNewName) {
      showNotification("Error: New file name cannot be empty.", 'alert');
      return;
    }
    if (!cleanNewName.toLowerCase().endsWith('.txt')) {
      cleanNewName += '.txt';
      logVerbose(`Appended .txt extension: ${cleanNewName}`);
    }
    const newFilePath = cleanNewName.startsWith('/') ? cleanNewName : `/${cleanNewName}`;
    if (newFilePath.toLowerCase() === oldFilePath.toLowerCase()) {
      logVerbose("Rename cancelled: New name is the same as the old name.");
      const renameModalElement = document.getElementById('renameFileModal');
      if (renameModalElement) {
        renameFileModalInstance = bootstrap.Modal.getInstance(renameModalElement);
        if (renameFileModalInstance) renameFileModalInstance.hide();
      }
      return;
    }
    const currentKnownFiles = getKnownFiles();
    if (currentKnownFiles.some(file => file.path.toLowerCase() === newFilePath.toLowerCase())) {
      showNotification(`Error: A file named "${cleanNewName}" already exists.`, 'alert');
      return;
    }

    logVerbose(`Attempting to rename file from "${oldFilePath}" to "${newFilePath}"`);
    const renameModalElement = document.getElementById('renameFileModal');
    if (renameModalElement) {
      renameFileModalInstance = bootstrap.Modal.getInstance(renameModalElement);
      if (renameFileModalInstance) renameFileModalInstance.hide(); // Hide modal
    }


    // --- Refined Rename Logic (Local First) ---
    try {
      // 1. Perform local rename first (includes moving data)
      logVerbose(`Attempting local rename for ${oldFilePath} to ${newFilePath}`);
      const localRenameSuccess = renameKnownFile(oldFilePath, cleanNewName, newFilePath);

      if (localRenameSuccess) {
        logVerbose(`Local rename successful. Updating UI...`);
        // 2. Update UI immediately after local success
        updateFileSelectionUI(); // Reflects the new active file name
        showNotification(`File renamed to "${cleanNewName}".`, 'success');

        try {
          const { renameGitFile, isGitEnabled } = await import('./git/api.js');
          if (isGitEnabled()) {
            logVerbose(`Attempting Git rename for ${oldFilePath} to ${newFilePath}...`);
            const oldFilename = oldFilePath.substring(1);
            const newFilename = newFilePath.substring(1);
            const gitRenameSuccess = await renameGitFile(oldFilename, newFilename);

            if (gitRenameSuccess) {
              logVerbose(`Git rename successful.`);
            } else {
              logVerbose(`Git rename failed or was not possible.`);
              showNotification(`Note: Could not rename file in Git. Local file is now "${cleanNewName}".`, 'warning');
            }
          }
        } catch (gitError) {
          console.error(`Error during Git rename attempt:`, gitError);
          logVerbose(`Git rename attempt failed: ${gitError.message}`);
        }

      } else {
        // Local rename failed, do not attempt Dropbox rename
        logVerbose(`Local rename failed for "${oldFilePath}" to "${newFilePath}".`);
        showNotification(`Failed to rename file locally. Check console for details.`, 'alert');
      }

    } catch (error) { // Catch errors during local rename or UI update
      console.error(`Error during file rename process:`, error);
      showNotification(`Failed to complete file rename process. Check console for details.`, 'alert');
    }
    // --- End Refined Rename Logic ---
  });
  logVerbose('Rename File modal listeners attached.');
}

export function toggleTodoCompletion(listItem) {
  const itemId = listItem.data('id');
  const itemText = listItem.find('span').text();
  const item = new jsTodoTxt.Item(itemText);

  item.setComplete(!item.complete()); // Toggle completion
  if (item.complete()) {
    item.clearPriority(); // Remove priority when completed
    if(item.created()){
      item.setCompleted(new Date()); // If there is a creation date set the complete date
    }
  } else {
    item.setCompleted(null); // Clear completion date if marked incomplete
  }

  updateTodoInStorage(itemId, item); // Update in storage
  applyItemStyles(listItem, item); // Update styles
  listItem.find('span').text(item.toString()); // Update the text in the span
  listItem.find('button[title]').attr('title', item.complete() ? 'Mark as Incomplete' : 'Mark as Done'); // Update button title
  loadTodos(todoList); // Reload the todos after completion toggle
}

export function startEditTodo(listItem) {
  const itemId = listItem.data('id');
  logVerbose(`startEditTodo called for item ID: ${itemId}`);
  const itemText = listItem.find('span').text();
  const item = new jsTodoTxt.Item(itemText);

  todoInput.val(itemText); // Populate input with current text
  addButton.text('Save Edit').data('editingId', itemId); // Change button text and store ID
  todoInput.focus(); // Focus the input

  prioritySelect.val(item.priority() || ''); // Select existing priority
  const project = item.projects()[0] || '';
  const context = item.contexts()[0] || '';

  // Update dropdown buttons and select values
  $('#projectDropdownButton').text(project ? `+${project}` : 'Project');
  projectSelect.val(project); // Use the variable directly
  $('#contextDropdownButton').text(context ? `@${context}` : 'Context');
  contextSelect.val(context); // Use the variable directly

  // Populate date pickers
  const creationDate = item.created(); // Returns Date object or null
  let dueDateString = null;
  const extensions = item.extensions(); // Get all extensions
  const dueExtension = extensions.find(ext => ext.key === 'due'); // Find the 'due' extension
  if (dueExtension) {
    dueDateString = dueExtension.value; // Assign the value if found
  }

  $('#createdDate').val(formatDateForPicker(creationDate));
  $('#dueDate').val(formatDateForPicker(dueDateString));

  // Remove the item from the list UI temporarily while editing
  // It will be re-added or updated when 'Save Edit' is clicked (handled in event-handlers.js)
  listItem.remove();
}

export function deleteTodoItem(listItem) {
  const itemId = listItem.data('id');
  logVerbose(`deleteTodoItem called for item ID: ${itemId}`);
  removeTodoFromStorage(itemId); // Remove from storage
  listItem.remove(); // Remove from the UI
  // No need to reload here, item is just removed.
}

// --- File Selection UI ---
export function updateFileSelectionUI() {
  logVerbose("Updating file selection UI...");
  const knownFiles = getKnownFiles();
  const activeFilePath = getActiveFile();
  let activeFileName = 'todo.txt'; // Default

  fileListSidebar.empty(); // Clear existing sidebar items

  knownFiles.forEach(file => {
    const listItem = $('<li class="nav-item"></li>'); // Use nav-item class
    const link = $('<a class="nav-link" href="#"></a>') // Use nav-link class
      .text(file.name)
      .data('path', file.path) // Store path in data attribute
      .click(async function(e) {
        e.preventDefault();
        const selectedPath = $(this).data('path');
        if (selectedPath !== getActiveFile()) {
          logVerbose(`Switching active file to: ${selectedPath}`);
          setActiveFile(selectedPath);
          loadTodos(todoList);
          updateFileSelectionUI();
          
          try {
            const gitSyncModule = await import('./git-sync-coordinator.js');
            if (gitSyncModule && gitSyncModule.coordinateSync) {
              logVerbose('Triggering sync for newly selected file...');
              await gitSyncModule.coordinateSync();
            }
          } catch (err) {
            console.error('Could not trigger sync on file switch:', err);
          }
        }
      });

    // Highlight the active file
    if (file.path === activeFilePath) {
      link.addClass('active'); // Add Bootstrap 'active' class
      activeFileName = file.name; // Update the name for the header
    }

    listItem.append(link);
    fileListSidebar.append(listItem); // Append to the sidebar list
  });

  // Update the main header text
  currentFileNameHeader.text(activeFileName);
  logVerbose(`Active file header text set to: ${activeFileName}`);
}

// --- Add listener for the modal's confirmation button ---
// This needs to be attached in the main $(document).ready() block
// We export a function that can be called from there.
export function setupDeleteFileConfirmListener() {
  $('#confirmDeleteFileButton').off('click.deleteconfirm').on('click.deleteconfirm', async function() {
    const modalElement = $('#deleteFileModalConfirm');
    const filePathToDelete = modalElement.data('filePathToDelete');
    const fileNameToDelete = modalElement.data('fileNameToDelete'); // Retrieve the stored name

    // Hide the modal first
    const deleteModalInstance = bootstrap.Modal.getInstance(modalElement[0]);
    if (deleteModalInstance) {
      deleteModalInstance.hide();
    }

    // Validate that we retrieved the data
    if (!filePathToDelete || !fileNameToDelete) {
      console.error("Could not retrieve file path or name from modal data for deletion confirmation.");
      showNotification("Error confirming deletion. Missing file details. Please try again.", 'alert');
      // Clear data just in case
      modalElement.removeData('filePathToDelete');
      modalElement.removeData('fileNameToDelete');
      return;
    }

    logVerbose(`Confirmed deletion for file: ${fileNameToDelete} (${filePathToDelete})`);

    // --- Modified Deletion Logic (Prioritize Local Removal) ---
    let gitDeleteAttempted = false;
    let gitDeleteSuccess = false;

    try {
      try {
        const { deleteGitFile, isGitEnabled } = await import('./git/api.js');
        if (isGitEnabled()) {
          logVerbose(`Attempting Git deletion for ${filePathToDelete}...`);
          gitDeleteAttempted = true;
          const filename = filePathToDelete.substring(1);
          gitDeleteSuccess = await deleteGitFile(filename);
          if (gitDeleteSuccess) {
            logVerbose(`Git deletion successful for ${filePathToDelete}.`);
          } else {
            logVerbose(`Git deletion failed for ${filePathToDelete}. Proceeding with local deletion.`);
          }
        }
      } catch (gitError) {
        console.error(`Error during Git delete attempt for ${filePathToDelete}:`, gitError);
        logVerbose(`Git delete attempt failed for ${filePathToDelete}: ${gitError.message}`);
      }

      logVerbose(`Proceeding with local removal for ${filePathToDelete}`);
      removeKnownFile(filePathToDelete);

      updateFileSelectionUI();
      loadTodos(todoList);

      showNotification(`File "${fileNameToDelete}" removed.`, 'success');
      if (gitDeleteAttempted && !gitDeleteSuccess) {
        showNotification(`Note: Could not remove "${fileNameToDelete}" from Git.`, 'warning');
      }

    } catch (error) { // Catch errors during local removal or UI update
      console.error(`Error during local deletion or UI update for ${filePathToDelete}:`, error);
      showNotification(`Failed to fully remove file "${fileNameToDelete}" locally. Check console for details.`, 'alert');
    } finally {
      // Clear data from modal after use
      modalElement.removeData('filePathToDelete');
      modalElement.removeData('fileNameToDelete');
    }
    // --- End Modified Deletion Logic ---
  });
  logVerbose('Delete file confirmation listener attached.');
}
