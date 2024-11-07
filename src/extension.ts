// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { error } from 'console';
import * as vscode from 'vscode';

const REPOMINDER_PARTICIPANT_ID = 'repominder';

interface RepoChatResult extends vscode.ChatResult {
	metadata: {
		command: string;
	}
}

// Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };

const logger: vscode.TelemetryLogger = vscode.env.createTelemetryLogger({
	sendEventData(eventName, data) {
		console.log(`Event: ${eventName}`);
		console.log(`Data: ${JSON.stringify(data)}`);
	},
	sendErrorData(error, data) {
		console.log(`Error: ${error}`);
		console.log(`Data: ${JSON.stringify(data)}`);
	}
});

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "repominder" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('repominder.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from RepoMinder!');
	});

	context.subscriptions.push(disposable);


	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest, 
		context: vscode.ChatContext, 
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	): Promise<RepoChatResult> => {
		if (request.prompt === '') {
			stream.markdown('Please provide a command.');
			return { metadata: { command: '' } };
		}

		// TODO: Preprocess the command

		stream.progress('Analyzing the codebase and generating answer...');
		try {
			// To get a list of all available models, do not pass any selector to the selectChatModels.
			const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
			if (model) {
				const messages = [
					vscode.LanguageModelChatMessage.User('Your are a very experienced developer and are very familiar with the codebase. Your job is to answer questions about the codebase.'),
					vscode.LanguageModelChatMessage.User(request.prompt),
				];
				const chatResponse = await model.sendRequest(messages, {}, token);

				for await (const fragment of chatResponse.text) {
					stream.markdown(fragment);
				}
			} else {
				throw vscode.LanguageModelError.NotFound(JSON.stringify(MODEL_SELECTOR));
			}
		} catch(error) {
			handleError(error, stream);
		}

		logger.logUsage('request', { command: request.prompt });
		return { metadata: { command: request.prompt } };
	};

	const repominder = vscode.chat.createChatParticipant(REPOMINDER_PARTICIPANT_ID, handler);
	repominder.iconPath = vscode.Uri.joinPath(context.extensionUri, 'repominder.jpeg');

	context.subscriptions.push(repominder.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
		logger.logUsage('chatResultFeedback', {
			kind: feedback.kind,
		});
	}));
}

function handleError(error: any, stream: vscode.ChatResponseStream): void {
	logger.logError(error);

	if (error instanceof vscode.LanguageModelError) {
		stream.markdown(vscode.l10n.t('Sorry, there seems to be an issue with the language model.'));
		stream.markdown(vscode.l10n.t('Error info is as follows:'));
		stream.markdown(`\`${error.message}\``);
		stream.markdown(vscode.l10n.t('Please try again later.'));
	} else {
		stream.markdown(vscode.l10n.t('Sorry, there seems to be an issue.'));
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
