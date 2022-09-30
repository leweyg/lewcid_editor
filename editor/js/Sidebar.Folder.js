import { UIListbox, UIPanel, UIRow, UISelect, UISpan, UIText } from './libs/ui.js';

import { FolderUtils } from "./FolderUtils.js"

function SidebarFolder( editor ) {

	var mCurrentPath = "../../";

	const config = editor.config;
	const strings = editor.strings;

	const container = new UISpan();

	const settings = new UIPanel();
	settings.setBorderTop( '0' );
	settings.setPaddingTop( '20px' );
	container.add( settings );

	// current
	const currentRow = new UIRow();
	const currentOption = new UIText(mCurrentPath);
	currentRow.add( new UIText( strings.getKey( 'sidebar/folder/current' ) ).setWidth( '90px' ) );
	currentRow.add( currentOption );
	settings.add( currentRow );

	// changeOption
	const changeDefaults = {
		'loading' : "Loading " + mCurrentPath + "...",
	};
	const changeRow = new UIRow();
	const changeOption = new UISelect().setWidth( '150px' );
	changeOption.setOptions( changeDefaults );
	changeOption.setValue( 'loading' );
	changeRow.add( new UIText( strings.getKey( 'sidebar/folder/change' ) ).setWidth( '90px' ) );
	changeRow.add( changeOption );
	settings.add( changeRow );

	// Files in that folder:
	const filesRow = new UIRow();
	const filesList = new UIListbox();
	filesList.setItems( [ {name:"Loading " + mCurrentPath + "..."} ] );
	filesRow.add( filesList );
	settings.add( filesRow );

	// Utility methods:

	function RefreshFolder() {

		currentOption.setTextContent(mCurrentPath);

		FolderUtils.ShellExecute("ls -1 -p",(file_list) => {
			var files = file_list.split("\n");
			var ops = { };
			ops["../"] = "../";
			var file_list = [];
			for (var i in files) {
				var path = files[i].trim();
				if (path == "") continue;

				var item = {
					name : path,
					full_path : mCurrentPath + path
				};
				function add_on_click(to) {
					to.onclick = (() => {
						mCurrentPath = to.full_path;
						RefreshFolder();
					});
				}
				add_on_click(item);

				file_list.push(item);

				if (path.endsWith("/")) {
					ops[path] = path;
				}
			}
			changeOption.setOptions( ops );
			filesList.setItems(file_list);
		}, mCurrentPath );
	}

	RefreshFolder();

	return container;

}

export { SidebarFolder };
