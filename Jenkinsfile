pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Import .env file') {
            steps {
                script {
                    sh "cp /var/lib/jenkins/ProjectBot/.env ."
                }
            }
        }

        stage('Stop old containers') {
            steps {
                script {
                    sh "docker-compose down"
                }
            }
        }

        stage('Start new containers') {
            steps {
                script {
                    sh "docker-compose up --build --detach"
                }
            }
        }

        stage('Logs') {
            steps {
                script {
                    sh "sleep 25"
                    sh "docker logs projectbot_prod_database_1"
                    sh "docker logs projectbot_prod_web_1"
                }
            }
        }

        stage('Remove old builds') {
            steps {
                script {
                    sh "docker system prune -f"
                    sh "docker container prune -f"
                    sh "docker volume prune -f"
                    sh "docker network prune -f"
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded! Perform any post-build steps here.'
        }
        failure {
            echo 'Pipeline failed. Take any necessary actions.'
        }
    }
}