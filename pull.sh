#!/bin/bash

githubuser=Istiak-A-Tashrif
githubpass=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
organization=PosBuzz
repo=PosClient
branch=main

git pull "https://$githubuser:$githubpass@github.com/$organization/$repo.git" $branch --no-rebase


