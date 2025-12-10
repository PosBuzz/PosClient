#!/bin/bash

githubuser=Istiak-A-Tashrif
githubpass=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
repo=PosClient
branch=main

git pull "https://$githubuser:$githubpass@github.com/$githubuser/$repo.git" $branch --no-rebase


