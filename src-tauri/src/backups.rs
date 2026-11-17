//! Backup files: written, listed, read and deleted in one folder the person
//! chooses. Only names that look like our own backups are ever touched, so
//! these commands cannot reach any other file.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct BackupFile {
    name: String,
    size: u64,
}

/// "life-of-pi-2026-11-17-0930.json", optionally with a "-2" style suffix.
fn is_backup_name(name: &str) -> bool {
    let Some(stem) = name.strip_prefix("life-of-pi-").and_then(|rest| rest.strip_suffix(".json")) else {
        return false;
    };
    !stem.is_empty() && stem.len() <= 40 && stem.chars().all(|c| c.is_ascii_digit() || c == '-')
}

fn file_in(dir: &str, name: &str) -> Result<PathBuf, String> {
    if !is_backup_name(name) {
        return Err(format!("{name} is not a backup file name"));
    }
    let dir = Path::new(dir);
    if !dir.is_absolute() {
        return Err("The backup folder has to be a full path".into());
    }
    Ok(dir.join(name))
}

/// Documents\Life Of Pi Backups, or the app's data folder if there is no Documents folder.
#[tauri::command]
pub fn backup_default_dir(app: AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;
    Ok(base.join("Life Of Pi Backups").to_string_lossy().into_owned())
}

/// Writes a backup in full or not at all: to a temporary name first, then renamed into place.
#[tauri::command]
pub fn backup_write(dir: String, name: String, text: String) -> Result<(), String> {
    let path = file_in(&dir, &name)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create the backup folder: {e}"))?;
    let partial = path.with_extension("json.partial");
    fs::write(&partial, text.as_bytes()).map_err(|e| format!("Could not write the backup: {e}"))?;
    fs::rename(&partial, &path).map_err(|e| {
        let _ = fs::remove_file(&partial);
        format!("Could not finish the backup: {e}")
    })
}

#[tauri::command]
pub fn backup_list(dir: String) -> Result<Vec<BackupFile>, String> {
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Could not read the backup folder: {e}")),
    };
    let mut files = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_backup_name(&name) {
            continue;
        }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        files.push(BackupFile { name, size });
    }
    Ok(files)
}

#[tauri::command]
pub fn backup_read(dir: String, name: String) -> Result<String, String> {
    fs::read_to_string(file_in(&dir, &name)?).map_err(|e| format!("Could not read the backup: {e}"))
}

#[tauri::command]
pub fn backup_delete(dir: String, name: String) -> Result<(), String> {
    match fs::remove_file(file_in(&dir, &name)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not delete the backup: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_our_own_names_are_accepted() {
        assert!(is_backup_name("life-of-pi-2026-11-17-0930.json"));
        assert!(is_backup_name("life-of-pi-2026-11-17-0930-2.json"));
        assert!(!is_backup_name("life-of-pi-../../secret.json"));
        assert!(!is_backup_name("notes.txt"));
        assert!(!is_backup_name("life-of-pi-.json"));
        assert!(!is_backup_name("life-of-pi-2026/11.json"));
    }

    #[test]
    fn writes_lists_reads_and_deletes() {
        let dir = std::env::temp_dir().join(format!("lop-backup-test-{}", std::process::id()));
        let dir = dir.to_string_lossy().into_owned();
        let name = "life-of-pi-2026-11-17-0930.json".to_string();
        backup_write(dir.clone(), name.clone(), "{\"ok\":true}".into()).unwrap();
        let listed = backup_list(dir.clone()).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(backup_read(dir.clone(), name.clone()).unwrap(), "{\"ok\":true}");
        backup_delete(dir.clone(), name).unwrap();
        assert!(backup_list(dir.clone()).unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
