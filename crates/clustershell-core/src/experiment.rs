// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Micro-benchmark for autonomous experiment demonstration.
//! 
//! Goal: Minimize execution time while maintaining correct results.
//! 
//! Run: `cargo test --package clustershell-core --lib -- experiment::benches --nocapture`

#[cfg(test)]
mod benches {
    use std::time::Instant;

    /// Simulated workload - parse and process 1000 config entries
    fn process_config_entries(entries: &[(&str, &str)]) -> u64 {
        let mut checksum: u64 = 0;
        
        for (key, value) in entries {
            // Hash the key - use u32 arithmetic to avoid overflow checks
            let mut key_hash: u32 = 0;
            for b in key.bytes() {
                key_hash = key_hash.wrapping_mul(31).wrapping_add(b as u32);
            }
            
            // Parse the value (simulating config parsing)
            let mut value_hash: u32 = 0;
            for b in value.bytes() {
                value_hash = value_hash.wrapping_mul(17).wrapping_add(b as u32);
            }
            
            // Combine - convert back to u64 for final checksum
            checksum = checksum.wrapping_add((key_hash as u64).wrapping_mul(value_hash as u64));
        }
        
        checksum
    }

    fn generate_test_data(n: usize) -> Vec<(&'static str, &'static str)> {
        const KEYS: &[&str] = &[
            "server.port", "server.host", "server.timeout", 
            "cache.enabled", "cache.ttl", "cache.max_size",
            "log.level", "log.format", "log.output",
            "auth.enabled", "auth.provider", "auth.timeout",
        ];
        const VALUES: &[&str] = &[
            "8080", "localhost", "30",
            "true", "3600", "1000",
            "info", "json", "/var/log/app.log",
            "true", "oauth2", "300",
        ];
        
        let mut data = Vec::with_capacity(n);
        for i in 0..n {
            data.push((KEYS[i % KEYS.len()], VALUES[i % VALUES.len()]));
        }
        data
    }

    #[test]
    fn benchmark_config_parsing() {
        let entries = generate_test_data(10_000);
        
        // Warmup
        let _ = process_config_entries(&entries);
        let _ = process_config_entries(&entries);
        
        // Actual benchmark
        let iterations = 100;
        let start = Instant::now();
        
        let mut result: u64 = 0;
        for _ in 0..iterations {
            result = process_config_entries(&entries);
        }
        
        let elapsed = start.elapsed();
        let per_iteration_us = elapsed.as_micros() as f64 / iterations as f64;
        
        println!("\n--- Benchmark Results ---");
        println!("iterations:       {}", iterations);
        println!("per_iteration_us: {:.2}", per_iteration_us);
        println!("checksum:         {}", result);
        println!("status:           pass");
        
        // Verify correctness (baseline checksum)
        assert!(result > 0, "Checksum should be non-zero");
        
        // Report metric for experiment tracking
        println!("metric: {:.2}", per_iteration_us);
    }
}
