# Claude Agent Spawner

A VS Code extension that spawns multiple Claude Code instances for parallel task execution. Seamlessly integrates with the Conductor workflow system.

## Features

- **Spawn Multiple Claude Agents**: Launch parallel Claude Code instances, each in its own terminal
- **Git Worktree Isolation**: Each agent works in its own isolated git worktree to prevent conflicts
- **Conductor Integration**: Automatically detects ASYNC tasks from Conductor tracks
- **Wave-Based Execution**: Spawn entire waves of tasks with dependency-aware ordering
- **Auto-Detection**: Automatically spawn agents when new ASYNC task files are detected
- **Claude Code-Style UI**: Familiar sidebar interface matching the existing Claude Code extension

## Installation

### From VSIX File

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Install from VSIX"
4. Select `claude-agent-spawner-1.0.0.vsix`

### From Source

```bash
cd claude-agent-spawner
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## Usage

### Sidebar

Click the **Claude Agents** icon in the Activity Bar to open the Agent Manager panel.

### Commands

| Command | Description |
|---------|-------------|
| `Spawn New Claude Agent` | Create a new agent with a custom prompt |
| `Spawn Multiple Agents from Tasks` | Select task files to spawn agents for |
| `Spawn Agents from Conductor Track` | Load a Conductor track and spawn ASYNC tasks |
| `Spawn Current Wave` | Spawn all tasks in the next pending wave |
| `Toggle Auto-Detection` | Enable/disable automatic task detection |
| `Kill All Agents` | Terminate all running agents |
| `Refresh Agent Status` | Update agent status display |

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `autoDetect.enabled` | `true` | Enable automatic task detection |
| `autoDetect.startOnActivation` | `true` | Start auto-detect when extension activates |
| `maxConcurrentAgents` | `5` | Maximum parallel agents |
| `useGitWorktrees` | `true` | Create isolated worktrees |
| `worktreeBasePath` | `../worktrees` | Path for worktree directories |
| `claudeCommand` | `claude` | CLI command to invoke Claude |

## Conductor Integration

The extension integrates with the Conductor workflow system:

1. Place your track in `.conductor/tracks/<track-name>/`
2. Use scrum-generated task files with naming convention:
   - `task_<phase>_<seq>_<name>.md` - Sequential tasks
   - `task_<phase>_<seq>_<name>_ASYNC.md` - Parallel tasks
3. The extension will detect ASYNC tasks and spawn agents automatically

### Task File Format

```markdown
---
status: pending
complexity: medium
---

# Task Name

## Description

Task description here...

## Dependencies

- task_1_1_setup
- task_1_2_config

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

## How It Works

1. **Detection**: Monitors `.conductor/tracks/` for ASYNC task files
2. **Dependency Analysis**: Checks task dependencies to determine spawn order
3. **Worktree Creation**: Creates isolated git worktree for each agent
4. **Terminal Spawn**: Opens VS Code terminal with Claude Code CLI
5. **Prompt Injection**: Sends task content as initial prompt
6. **Status Tracking**: Monitors terminal state and updates task status

## Requirements

- VS Code 1.85.0+
- Claude Code CLI installed (`claude` command available)
- Git (for worktree support)

## License

MIT

## Author

MasterChief / Anansi Trading
