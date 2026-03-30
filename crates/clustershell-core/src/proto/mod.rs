// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Generated protocol buffer code.
//!
//! This module re-exports the generated protobuf types and service definitions.

#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    unused_qualifications,
    rust_2018_idioms
)]
pub mod clustershell {
    include!(concat!(env!("OUT_DIR"), "/clustershell.v1.rs"));
}

#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    unused_qualifications,
    rust_2018_idioms
)]
pub mod datamodel {
    pub mod v1 {
        include!(concat!(env!("OUT_DIR"), "/clustershell.datamodel.v1.rs"));
    }
}

#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    unused_qualifications,
    rust_2018_idioms
)]
pub mod sandbox {
    pub mod v1 {
        include!(concat!(env!("OUT_DIR"), "/clustershell.sandbox.v1.rs"));
    }
}

#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    unused_qualifications,
    rust_2018_idioms
)]
pub mod test {
    include!(concat!(env!("OUT_DIR"), "/clustershell.test.v1.rs"));
}

#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    unused_qualifications,
    rust_2018_idioms
)]
pub mod inference {
    pub mod v1 {
        include!(concat!(env!("OUT_DIR"), "/clustershell.inference.v1.rs"));
    }
}

pub use datamodel::v1::*;
pub use inference::v1::*;
pub use clustershell::*;
pub use sandbox::v1::*;
pub use test::ObjectForTest;

// Backward compatibility alias for the renamed client module
pub mod open_shell_client {
    pub use super::cluster_shell_client::*;
}
