import { UIPanel, UIRow, UISelect, UISpan, UIText } from './libs/ui.js';

import { FolderUtils } from "./FolderUtils.js"

function SidebarFolder( editor ) {

	const config = editor.config;
	const strings = editor.strings;

	const container = new UISpan();

	const settings = new UIPanel();
	settings.setBorderTop( '0' );
	settings.setPaddingTop( '20px' );
	container.add( settings );

	// language

	const options = {
		'home': 'home (~)',
		'project': 'project',
	};

	const languageRow = new UIRow();
	const language = new UISelect().setWidth( '150px' );
	language.setOptions( options );
	language.setValue( 'home' );


	languageRow.add( new UIText( strings.getKey( 'sidebar/folder/change' ) ).setWidth( '90px' ) );
	languageRow.add( language );

	settings.add( languageRow );

	FolderUtils.ShellExecute("ls -1 -p",(file_list) => {
		var files = file_list.split("\n");
		var ops = { };
		var firstKey = null;
		for (var i in files) {
			var path = files[i].trim();
			if (path == "") continue;
			firstKey = path;
			ops[path] = path;
		}
		language.setOptions( ops );
		language.setValue( firstKey );

	});

	return container;

}

export { SidebarFolder };
