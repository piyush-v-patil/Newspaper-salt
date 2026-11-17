mod backups;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

const TRAY_ID: &str = "main";
const APP_NAME: &str = "Life Of Pi";

/// Brings the main window back, from the tray or when the app is launched a second time.
fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Shows the running timer on the tray icon's tooltip; `None` clears it.
#[tauri::command]
fn set_tray_status(app: AppHandle, label: Option<String>) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let text = match &label {
            Some(text) => format!("{text} · {APP_NAME}"),
            None => APP_NAME.to_string(),
        };
        let _ = tray.set_tooltip(Some(&text));
    }
}

/// Lets the web side bring the main window forward, e.g. after a global shortcut.
#[tauri::command]
fn show_main_window(app: AppHandle) {
    show_main(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch focuses the copy already running instead of opening another.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            set_tray_status,
            show_main_window,
            backups::backup_default_dir,
            backups::backup_write,
            backups::backup_list,
            backups::backup_read,
            backups::backup_delete
        ])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Life Of Pi", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let icon = app
                .default_window_icon()
                .cloned()
                .expect("the bundle always includes an app icon");

            TrayIconBuilder::with_id(TRAY_ID)
                .icon(icon)
                .tooltip(APP_NAME)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Started at login: stay in the tray rather than open a window.
            if std::env::args().any(|arg| arg == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window keeps the app in the tray, so timers,
            // reminders and the focus bar carry on. Quit from the tray menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Life Of Pi");
}
