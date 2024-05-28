//All notifications:
export const trelloNotifications = [
  {
      name: "Card Created",
      description: "Triggered when a Trello card is created",
      codename: "createCard"
  },
  {
      name: "Card Updated",
      description: "Triggered when a Trello card is updated",
      codename: "updateCard"
  },
  {
    name: "Card Move",
    description: "Triggered when a Trello card is moved",
      codename: "moveCard"
  },
  {
      name: "Card Deleted",
      description: "Triggered when a Trello card is deleted",
      codename: "deleteCard"
  },
  {
      name: "List Created",
      description: "Triggered when a Trello list is created",
      codename: "createList"
  },
  {
      name: "List Updated",
      description: "Triggered when a Trello list is updated",
      codename: "updateList"
  },
  {
      name: "List Deleted",
      description: "Triggered when a Trello list is deleted",
      codename: "deleteList"
  }
]
  
export const githubNotifications = [
  { name: "Push", description: "Triggered when a push is made", codename: "github-push" },
  { name: "Pull Request", description: "Triggered when a pull request is made", codename: "github-pull-request" },
  { name: "Release", description: "Triggered when a release is made", codename: "github-release" },
  { name: "Discussions", description: "Triggered when a discussion is made", codename: "github-discussions" },
  { name: "Branch", description: "Triggered when a branch is made", codename: "github-branch" },
  { name: "Commit", description: "Triggered when a commit is made", codename: "github-commit" },
  { name: "Deployment", description: "Triggered when a deployment is made", codename: "github-deployment" },
  { name: "Deployment Status", description: "Triggered when a deployment status is updated", codename: "github-deployment-status" },
  { name: "Member", description: "Triggered when a member is added", codename: "github-member" },
  { name: "Pull Request Review", description: "Triggered when a pull request review is made", codename: "github-pull-request-review" },
  { name: "Pull Request Review Comment", description: "Triggered when a pull request review comment is made", codename: "github-pull-request-review-comment" },
  { name: "Pull Request Review Thread", description: "Triggered when a pull request review thread is made", codename: "github-pull-request-review-thread" },
];

export const googleNotifications = [
  { name: "Calendar Event Created", description: "Triggered when a Google Calendar event is created", codename: "google-calendar-event-created" },
  { name: "Calendar Event Updated", description: "Triggered when a Google Calendar event is updated", codename: "google-calendar-event-updated" },
  { name: "Calendar Event Deleted", description: "Triggered when a Google Calendar event is deleted", codename: "google-calendar-event-deleted" },
];
