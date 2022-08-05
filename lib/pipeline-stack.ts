import { Duration, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { CodeBuildAction, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';

export class PipelineStack extends Stack {
  public readonly projectName: string = this.node.tryGetContext('projectname');
  public readonly deploymentStage: string = this.node.tryGetContext('env');

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new codepipeline.Pipeline(this, `${this.projectName}-${this.deploymentStage}`, {
      pipelineName: `${this.projectName}-${this.deploymentStage}`,
      crossAccountKeys: false,
    });

    const gitHubSourceArtifacts = new codepipeline.Artifact();

    const gitHubSourceAction = new GitHubSourceAction({
      actionName: 'DownloadSourceCode',
      owner: 'vibhasfl',
      repo: 'cicddemoapps',
      oauthToken: SecretValue.secretsManager('github', { jsonField: 'githuboauthtoken' }),
      branch: 'dev',
      output: gitHubSourceArtifacts,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [gitHubSourceAction],
    });

    const buildStageArtifacts = new codepipeline.Artifact();

    const InstallDependencies = new CodeBuildAction({
      actionName: 'InstallDependencies',
      input: gitHubSourceArtifacts,
      outputs: [buildStageArtifacts],
      project: new codebuild.PipelineProject(this, `${this.projectName}-codebld-${this.deploymentStage}`, {
        buildSpec: BuildSpec.fromSourceFilename('codebuild.yml'),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
          computeType: codebuild.ComputeType.SMALL,
        },
        timeout: Duration.minutes(5),
      }),
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [InstallDependencies],
    });
  }
}
