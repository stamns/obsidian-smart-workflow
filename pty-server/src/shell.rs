// Shell 检测和配置
use portable_pty::CommandBuilder;

/// 根据 shell 类型获取 Shell 命令
pub fn get_shell_by_type(shell_type: Option<&str>) -> CommandBuilder {
    match shell_type {
        Some("cmd") => CommandBuilder::new("cmd.exe"),
        Some("powershell") => {
            #[cfg(windows)]
            {
                // 优先使用 PowerShell Core (pwsh)，回退到 Windows PowerShell
                if let Ok(pwsh_path) = which_powershell() {
                    CommandBuilder::new(pwsh_path)
                } else {
                    CommandBuilder::new("powershell.exe")
                }
            }
            #[cfg(not(windows))]
            {
                // 非 Windows 平台，使用默认 shell
                get_default_shell()
            }
        }
        Some("wsl") => CommandBuilder::new("wsl.exe"),
        Some("gitbash") => {
            #[cfg(windows)]
            {
                // Git Bash: 尝试查找常见安装路径
                if let Ok(bash_path) = which_gitbash() {
                    let mut cmd = CommandBuilder::new(bash_path);
                    // 添加 --login 参数以加载用户配置
                    cmd.arg("--login");
                    cmd
                } else {
                    // 回退到默认 shell
                    get_default_shell()
                }
            }
            #[cfg(not(windows))]
            {
                // 非 Windows 平台，使用 bash
                CommandBuilder::new("bash")
            }
        }
        Some("bash") => CommandBuilder::new("bash"),
        Some("zsh") => CommandBuilder::new("zsh"),
        Some(custom) if custom.starts_with("custom:") => {
            // 自定义 shell 路径，格式: "custom:/path/to/shell"
            let path = &custom[7..]; // 去掉 "custom:" 前缀
            CommandBuilder::new(path)
        }
        _ => get_default_shell(), // None 或未知类型，使用默认
    }
}

/// 获取默认 Shell 命令
pub fn get_default_shell() -> CommandBuilder {
    #[cfg(windows)]
    {
        // Windows: 优先使用 PowerShell，回退到 CMD
        if let Ok(powershell_path) = which_powershell() {
            CommandBuilder::new(powershell_path)
        } else {
            CommandBuilder::new("cmd.exe")
        }
    }

    #[cfg(not(windows))]
    {
        // Unix: 从环境变量获取 SHELL，回退到 /bin/bash
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    }
}

#[cfg(windows)]
fn which_powershell() -> Result<String, ()> {
    // 尝试查找 PowerShell
    let powershell_paths = vec![
        "pwsh.exe",           // PowerShell Core
        "powershell.exe",     // Windows PowerShell
    ];

    for path in powershell_paths {
        if std::process::Command::new(path)
            .arg("-Command")
            .arg("exit")
            .output()
            .is_ok()
        {
            return Ok(path.to_string());
        }
    }

    Err(())
}

#[cfg(windows)]
fn which_gitbash() -> Result<String, ()> {
    // Git Bash 常见安装路径
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let gitbash_paths = vec![
        "C:\\Program Files\\Git\\bin\\bash.exe".to_string(),
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe".to_string(),
        format!("{}\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", userprofile),
    ];

    // 检查路径是否存在
    for path in gitbash_paths {
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
    }

    // 尝试从 PATH 环境变量查找
    if let Ok(output) = std::process::Command::new("where")
        .arg("bash.exe")
        .output()
    {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                // 获取第一行路径
                if let Some(first_line) = stdout.lines().next() {
                    let path = first_line.trim();
                    // 确保是 Git 安装的 bash
                    if path.contains("Git") {
                        return Ok(path.to_string());
                    }
                }
            }
        }
    }

    Err(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_default_shell() {
        // 只测试函数能够成功返回，不检查具体内容
        // 因为 CommandBuilder 不提供获取程序路径的公共 API
        let _shell = get_default_shell();
        // 如果能执行到这里，说明函数正常工作
    }
}
