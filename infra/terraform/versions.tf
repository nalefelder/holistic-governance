terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Recommended: store state in a GCS bucket in australia-southeast1 so state
  # (which can contain resource metadata) also stays in-region. Create the
  # bucket first, then uncomment and run `terraform init -migrate-state`.
  #
  # backend "gcs" {
  #   bucket = "hg-au-tfstate"
  #   prefix = "static-site"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
