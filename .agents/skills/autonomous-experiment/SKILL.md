# autonomous-experiment

Run autonomous experiments within ClusterShell sandboxes, inspired by the autoresearch pattern.

## Purpose

This skill enables agents to run long-running autonomous experiments with:
- Fixed time budgets per experiment
- Automatic result logging
- Git branching for experiment isolation
- "Never stop" autonomous loop pattern

## When to Use

- Running iterative experiments (model training, hyperparameter search)
- Autonomous code improvement loops
- Long-running optimization tasks
- Any task that benefits from "run while you sleep" automation

## Setup

Before running autonomous experiments:

1. **Create an experiment directory** under `experiments/<name>/`
2. **Create a `program.md`** with experiment instructions
3. **Initialize `results.tsv`** with the header row

## Experiment Directory Structure

```
experiments/
└── <experiment-name>/
    ├── program.md       # Agent instructions (what to try, how to evaluate)
    ├── results.tsv      # Experiment log (tab-separated)
    ├── code/            # Code being iterated on (optional, could be symlink)
    └── data/            # Experiment data (optional)
```

## program.md Pattern

The `program.md` file is a lightweight Markdown file that tells the agent:

1. **Goal** - What metric to optimize (e.g., "lowest val_loss")
2. **Constraints** - Time budget, resource limits
3. **What to modify** - Which files/parameters are fair game
4. **Evaluation** - How to measure success
5. **Logging format** - How to record results

Example:

```markdown
# Experiment: Optimize Inference Latency

## Goal
Minimize p99 latency while maintaining accuracy > 95%.

## Time Budget
Each experiment runs for 5 minutes.

## What to Modify
- `crates/clustershell-router/src/inference.rs` - inference logic
- Batch sizes, caching strategies, model routing

## Evaluation
Run `cargo bench --bench inference` and extract p99 latency.

## Logging
Record in `results.tsv`:
- commit hash
- p99_latency_ms
- accuracy_percent
- status (keep/discard/crash)
- description
```

## results.tsv Format

Tab-separated with columns:

| commit | metric | memory | status | description |
|--------|--------|--------|--------|-------------|
| a1b2c3d | 45.2 | 1.2 | keep | baseline |
| b2c3d4e | 42.1 | 1.3 | keep | add caching |

## Experiment Loop

```bash
# 1. Create experiment branch
git checkout -b experiment/<name>

# 2. Run experiment (inside sandbox for isolation)
clustershell sandbox create --name exp-<name>
clustershell sandbox connect exp-<name>

# 3. Inside sandbox, run the experiment loop:
# - Make changes
# - Run evaluation
# - Log results
# - If improved, commit and continue
# - If not, reset and try something else

# 4. NEVER STOP - continue until interrupted
```

## Key Principles (from autoresearch)

1. **Fixed time budget** - Each experiment takes the same time, making results comparable
2. **Never stop** - The loop runs until manually interrupted
3. **Log everything** - Every experiment is recorded, even failures
4. **Git as state** - Each experiment is a commit; advancing = keeping, resetting = discarding
5. **Simplicity wins** - A small improvement with simpler code is better than a large one with complex code

## Integration with ClusterShell

### Running Inside a Sandbox

```bash
# Create sandbox for experiments
clustershell sandbox create --name auto-exp --from base

# The sandbox provides:
# - Isolated environment
# - Policy-enforced network access
# - Resource limits
# - Automatic cleanup

# Inside sandbox:
clustershell sandbox connect auto-exp
# Now run your experiment loop
```

### Policy for Experiments

Experiments may need broader network access for:
- Downloading datasets
- Fetching model weights
- API calls for evaluation

Create a policy that allows necessary access:

```yaml
network:
  rules:
    - name: experiment-apis
      allow:
        - host: "*.huggingface.co"
          methods: [GET]
        - host: "api.github.com"
          methods: [GET]
```

## Commands

| Command | Description |
|---------|-------------|
| `clustershell experiment start <name>` | Initialize a new experiment |
| `clustershell experiment run <name>` | Run one experiment iteration |
| `clustershell experiment log <name>` | View experiment results |
| `clustershell experiment compare <name>` | Compare all results |

## Example: Autonomous Hyperparameter Search

```markdown
# program.md

## Goal
Find optimal batch_size and learning_rate for the router model.

## Time Budget
3 minutes per experiment.

## What to Modify
- `router/config.toml`: batch_size (powers of 2: 32, 64, 128, 256)
- `router/config.toml`: learning_rate (log scale: 1e-5 to 1e-2)

## Evaluation
```bash
cd router && cargo train --quick
# Extract final val_loss from output
```

## Logging
commit\tbatch_size\tlearning_rate\tval_loss\tstatus\tdescription
```

## Safety Considerations

- Experiments run in sandboxes with policy enforcement
- GPU access requires explicit `--gpu` flag
- Network access is controlled by policy
- Filesystem access is sandbox-scoped
- Experiments can be terminated via `clustershell sandbox delete`

## See Also

- `experiment-tracking` - Analyzing and comparing experiment results
- `generate-sandbox-policy` - Creating policies for experiments
- [autoresearch](https://github.com/karpathy/autoresearch) - Original inspiration
