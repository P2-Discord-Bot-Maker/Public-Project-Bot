import axios from 'axios'; // Import axios for API requests
import { getIntegrationId, getToken } from '../database/database.js'; // Import database functions
import { Octokit } from '@octokit/core' // Import Octokit for GitHub API requests

/**
 * Create a new Octokit instance
 * @param {string} guildId - The ID of the guild
 * @returns {Promise<unknown>} - The Octokit instance
 */
async function newOctokitInstance(guildId) {
    try {
        // Check if the guild ID is undefined
        if (!guildId || guildId === undefined || guildId === null) {
            throw new Error("Guild ID is undefined");
        }

        // Get integration id
        const integrationId = await getIntegrationId(guildId, "github");
        
        // Check if the integration id is undefined
        if (!integrationId) {
            throw new Error("Integration ID is undefined");
        }
        
        // Get the GitHub Token
        const githubToken = await getToken(integrationId, "Token");
        // Create a new Octokit instance
        const octokit = new Octokit({
            auth: githubToken
        });

        // Return the Octokit instance
        return octokit;
        
    // Error handling
    } catch (error) {
        console.error("Error getting creatinng octokit instance", error);
        throw error;
    }
}

/**
 * - Get the GitHub Token
 * @param {string} guildId - The ID of the guild
 * @returns {Promise<unknown>} - The GitHub Token
 */
async function getGithubToken(guildId) {
    try {
        // Get the integration id
        const integrationId = await getIntegrationId(guildId, "github");

        // Check if the integration id is undefined
        if (!integrationId) {
            throw new Error("Integration ID is undefined");
        }
        // Get the GitHub Token
        const githubToken = await getToken(integrationId, "Token");

        // Return the GitHub Token
        return githubToken;
    // Error handling
    } catch (error) {
        console.error("Error getting GitHub token");
        throw error;
    }
}

/**
 * Get all members of an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param guildId - The ID of the guild
 * @param type - Assignee or reviewer
 * @returns {Promise<unknown>} - Array of every member in the organization
 */
async function getAllMembers(owner, repo, pullrequest, guildId, type, command) {
    try {
        // Create a new Octokit instance
        const octokit = await newOctokitInstance(guildId);

        let members = await getAllPullRequests(owner, repo, guildId)
        .then(requests => requests.filter(request => request.title === pullrequest)) // Filter by the title of the pull request
        .then(requests => requests[0]);

        // Get the owner of the pull request
        const pullRequestOwner = members.user.login;
        
        // Get every member not already an assignee to the pull request
        if (type === 'Assignee') {
            // Get all assignees of a pull request
            members = members.assignees.map(assignee => assignee.login);    
                
        // Get every member not already a reviewer to the pull request
        } else if (type === 'Reviewer') {
            // Get all reviewers of a pull request
            members = members.requested_reviewers.map(reviewer => reviewer.login);
        }

        let resultingMembers;
        
        // Handle the assign command
        if (command === 'assign') {

            // Get all collaborators in repo
            resultingMembers = await octokit.request('GET /repos/{owner}/{repo}/collaborators', {
                owner: owner,
                repo: repo,
                headers: {
                'X-GitHub-Api-Version': '2022-11-28', 
                }
            })
            .then(response => response.data.map(member => member.login)) // Get their logins
            .then(response => response.filter(member => !members.includes(member) && member !== pullRequestOwner)); // Filter out the ones that are in or is the pullrequest owner
        
        // Handle the resign command
        } else if (command === 'resign') {
            resultingMembers = members; // Get the members that are already in the pull request (assignees or reviewers)
        }

        // Check if there are no available members
        if (resultingMembers.length === 0) {
            throw new Error("No available members found");
        }
        
        // Return the members not in the pull request
        return resultingMembers;
        
    // Error handling
    } catch (error) {
        console.log("Error getting all members of the organization:", error);
        throw error;
    }
}
/**
 * Get the latest commit SHA for the main branch of a repository
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @returns {Promise<unknown>} - The response from the API
 */
async function getLatestCommit(owner, repo, guildId) {
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);

        // Get the latest commit for the main branch
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/main`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        // Return the SHA of the latest commit
        return response.data.sha;
    // Error handling
    } catch (error) {
        console.error('Error getting latest commit:', error.response.data);
        throw error;
    }
}


/**
 * Get all owners of repositories
 * @returns {Promise<unknown>} - The response from the API
 */
async function getAllOwners(guildId) {
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);

        // Get user repos
        const response = await axios.get('https://api.github.com/user/repos', {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const owners = response && response.data ? [...new Set(response.data.map(repo => repo.owner.login))] : [];

        // Get organization repos
        const orgResponse = await axios.get('https://api.github.com/user/orgs', {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const orgOwners = orgResponse && orgResponse.data ? [...new Set(orgResponse.data.map(org => org.login))] : [];

        // Return all owners
        return [...owners, ...orgOwners];

    // Error handling
    } catch (error) {
        console.error('Error getting all owners:', error.response.data);
        throw error;
    }
}

/**
 * Get all repositories for a user or organization
 * @param owner - The name of the owner
 * @returns {Promise<unknown>} - The response from the API
 */
async function getAllRepos(owner, guildId) {
    try {
        const githubToken = await getGithubToken(guildId);

        //const userUrl = `https://api.github.com/users/${owner}/repos`;
        const userUrl = `https://api.github.com/search/repositories?q=user:${owner}`
        const response = await axios.get(userUrl, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.data.total_count === 0) {
            throw new Error('User has no repos');
        }

        let repos = response.data.items;

        // Return the names of the repos
        return repos.map(repo => repo.name);
    // Error handling
    } catch (error) {
        try {
            const orgUrl = `https://api.github.com/orgs/${owner}/repos`;
            const orgResponse = await axios.get(orgUrl, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            return orgResponse.data.map(repo => repo.name);
        } catch (orgError) {
            console.error('Error getting org repos:', orgError.response.data);
            throw orgError;
        }
    }
}

/**
 * Get all branches for a repository
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @returns {Promise<unknown>} - The response from the API
 */
async function getAllBranches(owner, repo, guildId) {
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);
        
        // Get all branches for the repository
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        // Return the names of the branches
        return response.data.map(branch => branch.name);
    // Error handling
    } catch (error) {
        console.error('Error getting all branches:', error.response.data);
        throw error;
    }
}

/**
 * Assign a member to a pull request in a repository owned by an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param pullRequestTitle - The title of the pull request
 * @param member - The member to assign
 * @param guildId - The ID of the guild
 * @param type - Assignee or rev)ewer
 * @returns {Promise<unknown>} - The response from the API
 */
async function assignMemberToPullRequest(owner, repo, pullRequestTitle, member, guildId, type) {
    
    // Get the token from the database
    const githubToken = await getGithubToken(guildId);

    // Get all pull requests for the repository
    const pullRequestList = await getAllPullRequests(owner, repo, guildId);

    // Find the pull request with the matching title
    const pullRequest = pullRequestList.find(pr => pr.title === pullRequestTitle);

    // Check if the pull request exists
    if (!pullRequest) {
        throw new Error(`Pull request with title "${pullRequestTitle}" not found`);
    }

    // Assign the member to the pull request
    try {
        // Assign as an assignee
        if (type === 'Assignee') {
            // Assign the member to the pull request as an assignee
            const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/issues/${pullRequest.number}/assignees`, {
                assignees: [member]
            }, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
           
        // Assign as a reviewer
        } else if (type === 'Reviewer') {

            const octokit = await newOctokitInstance(guildId);

            const response = await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
                owner: owner,
                repo: repo,
                pull_number: pullRequest.number,
                reviewers: [member],
                team_reviewers: [],
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            })
        }
    // Error handling
    } catch (error) {
        console.error('Error asigning member to pull request:', error);
        throw error;
    }
}

/**
 * Resign a member from a pull request in a repository owned by an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param pullRequestTitle - The title of the pull request
 * @param assignee - The member to resign
 * @param guildId - The ID of the guild
 * @param type - Assignee or reviewer
 * @returns {Promise<unknown>} - The response from the API
 */
async function resignMemberToPullRequest(owner, repo, pullRequestTitle, assignee, guildId, type) {
    // Get the token from the database
    const githubToken = await getGithubToken(guildId);

    const pullRequestList = await getAllPullRequests(owner, repo, guildId);
    // Find the pull request with the matching title
    const pullRequest = pullRequestList.find(pr => pr.title === pullRequestTitle);

    // Check if the pull request exists
    if (!pullRequest) {
        throw new Error(`Pull request with title "${pullRequestTitle}" not found`);
    }
    // Resign the member from the pull request
    let response;
    try {
        // Resign a assignee
        if (type === 'Assignee') {
            // Assign the member to the pull request as an assignee
            response = await axios.delete(`https://api.github.com/repos/${owner}/${repo}/issues/${pullRequest.number}/assignees`, {
                data: {
                    assignees: [assignee]
                },
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

        // Resign a reviewer
        } else if (type === 'Reviewer') {
            // Create new octokit instance
            const octokit = await newOctokitInstance(guildId);
            
            // Resign the member from the pull request as a reviewer
            response = await octokit.request('DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
                owner: owner,
                repo: repo,
                pull_number: pullRequest.number,
                reviewers: [assignee],
                team_reviewers: [],
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
              })
        }

    // Error handling
    } catch (error) {
        console.error('Error resigning member to pull request:', error);
        throw error;
    }
}

/**
 * Get all pull requests for a repository
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @returns {Promise<unknown>} - The response from the API
 */
async function getAllPullRequests(owner, repo, guildId) {
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);

        // Get all pull requests for the repository
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        // Return the pull requests
        return response.data;
    // Error handling
    } catch (error) {
        console.error('Error getting all pull requests:', error.response.data);
        throw error;
    }
}

/**
 * Create a pull request in a repository owned by an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param title - The title of the pull request
 * @param head - The branch to merge into the base branch
 * @param base - The branch to merge into the head branch
 * @returns {Promise<unknown>} - The response from the API
 */
async function createPullRequest(owner, repo, title, head, base, guildId) {
    // Create a new pull request
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);
        
        // Create a new pull request
        const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            title,
            head,
            base
        }, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        // Return the response
        return response.data;
    // Error handling
    } catch (error) {
        // Get and throw the error message
        console.error('Error creating pull request:', error.response.data.errors[0].message);
        throw new Error(error.response.data.errors[0].message);
    }
}

/**
 * Close a pull request in a repository owned by an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param title - The title of the pull request
 * @returns {Promise<unknown>} - The response from the API
 */
async function closePullRequest(owner, repo, title, guildId) {
    // Close a pull request
    try {
        // Get the token from the database
        
        // Get all pull requests for the repository
        const pullRequestList = await getAllPullRequests(owner, repo, guildId);

        // Find the pull request with the matching title
        const pullRequest = pullRequestList.find(pr => pr.title === title);

        // Check if the pull request exists
        if (!pullRequest) {
            throw new Error(`Pull request with title "${title}" not found`);
        }

        const octokit = await newOctokitInstance(guildId);
        
        // Close the pull request
        const response = await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: owner,
            repo: repo,
            pull_number: pullRequest.number,
            state: 'closed',
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
          })

        // Return the response
        return response.data;
    // Error handling
    } catch (error) {
        console.error('Error deleting pull request:', error.response.data);
        throw error;
    }
}


/**
 * Create a branch in a repository owned by an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param branchName - The name of the branch
 * @returns {Promise<unknown>} - The response from the API
 */
async function createBranch(owner, repo, branchName, guildId) {
    // Create a new branch
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);
        
        // Get the latest commit
        const sha = await getLatestCommit(owner, repo, guildId);
        
        // Create a new branch
        const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
            ref: `refs/heads/${branchName}`,
            sha
        }, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        // Return the response
        return response.data;
    // Error handling
    } catch (error) {
        console.error('Error creating branch:', error.response.data);
        throw error;
    }
}

/**
 * Delete a branch in a repository owned by an organization
 * @param owner - The name of the owner
 * @param repo - The name of the repository
 * @param branchName - The name of the branch
 * @returns {Promise<unknown>} - The response from the API
 */
async function deleteBranch(owner, repo, branchName, guildId) {
    // Delete a branch
    try {
        // Get the token from the database
        const githubToken = await getGithubToken(guildId);
        
        // Delete the branch
        const response = await axios.delete(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        // Return the response
        return response.data;
    // Error handling
    } catch (error) {
        console.error('Error deleting branch:', error.response.data);
        throw error;
    }
}

/**
 * Validate inputs
 * @param {string} guildId - The ID of the guild
 * @param {string} owner - The name of the owner
 * @param {string} repo - The name of the repository
 * @param {string} title - The title of the pull request
 * @param {string} type - Assignee or reviewer
 * @param {string} member - The member to assign or resign
 */
async function validation(guildId, owner = undefined, repo = undefined, title = undefined, type = undefined, member = undefined, command = undefined, branchTitle = undefined) {
    try {
        // Check if the owner is a valid github user
        if (owner !== undefined && !(await getAllOwners(guildId)).includes(owner)) {
            throw new Error(`The user ${owner} is not a valid GitHub user`);
        }
        // Check if the repo is a valid github repository
        if (repo !== undefined && !(await getAllRepos(owner, guildId)).includes(repo)) {
            throw new Error(`The user ${owner} does not have a GitHub repository named ${repo}`)
        }
        // Check if the title is a valid pull request
        if (title !== undefined) {
            // 
            const pullRequests = await getAllPullRequests(owner, repo, guildId)
            .then(requests => requests.map(request => request.title));
            if (!pullRequests.includes(title)) {
                throw new Error(`There are no pull request named '${title}' in the repository ${repo}`);
            }
        }
        // Check if the type is a valid type
        if (type !== undefined && type !== 'Assignee' && type !== 'Reviewer') {
            throw new Error(`Type ${type} is not valid, it must be 'Assignee' or 'Reviewer'`);
        }
        // Check if the member is a valid member
        if (member !== undefined && !(await getAllMembers(owner, repo, title, guildId, type, command)).includes(member)) {
            throw new Error(`The member ${member} was not found as ${type} on ${title} on ${repo}!`);
        }

        // Check if the branch title is alphanumeric
        if (!/^[a-zA-Z0-9]+$/.test(branchTitle)) {
            throw new Error("Branch title must only contain alphanumeric characters");
        }
    // Error handling
    } catch (error) {
        console.error("Error in validation", error.message);
        throw error;
    }
}

/**
 * Get all branches that are ahead of the base branch
 * @param {string} owner - The name of the owner
 * @param {string} repo - The name of the repository
 * @param {string} base - The name of the base branch
 * @param {string} guildId - The ID of the guild
 * @returns {Promise<unknown>} - Branches ahead of the base branch
 */
async function getAheadBranches(owner, repo, base, guildId) {
    try {
        // Get all branches and filter out the base branch
        let branches = await getAllBranches(owner, repo, guildId)
        .then(branches => branches.filter(branch => branch !== base));

        // Set all the branches that are not ahead as null, then filter out those
        const aheadBranches = await Promise.all(branches.map(async (branch) => {
            if (await isBranchAhead(owner, repo, branch, base, guildId)) {
                return branch;
            } else {
                return null;
            }
        }))
        .then(branches => branches.filter(branch => branch !== null));

        return aheadBranches;
    // Error handling
    } catch (error) {
        console.error("getAheadBranches:", error);
        throw error;
    }
}

/**
 * Check if a branch is ahead of another branch
 * @param {string} owner - The name of the owner
 * @param {string} repo - The name of the repository
 * @param {string} head - The name of the head branch
 * @param {string} base - The name of the base branch
 * @param {string} guildId - The ID of the guild
 * @returns {Promise<unknown>} - True if head is ahead of base, false otherwise
 */
async function isBranchAhead(owner, repo, head, base, guildId) {
    try {
        // Create a new octokit instance
        const octokit = await newOctokitInstance(guildId);

        // Get all the commits in the base branch
        const baseCommits = await octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: owner,
            repo: repo,
            sha: base
        })
        .then(response => response.data.map(commit => commit.sha));

        // Get all the commits in the head branch
        const headCommits = await octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: owner,
            repo: repo,
            sha: head
        })
        .then(response => response.data.map(commit => commit.sha));

        // Check that the base does not inclde the heads commits
        const isAhead = headCommits.some(commit => !baseCommits.includes(commit));

        return isAhead;
    // Error handling
    } catch (error) {
        console.error("isBranchAhead error:", error);
        throw error;
    }
}

// Export the functions
export {createPullRequest, createBranch, closePullRequest, deleteBranch, getAllBranches, getAllOwners, getAllRepos, assignMemberToPullRequest, getAllPullRequests, getAllMembers, resignMemberToPullRequest, validation, getAheadBranches };