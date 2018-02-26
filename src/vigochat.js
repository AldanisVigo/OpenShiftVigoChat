function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function unescapeHtml(escapedStr) {
    var div = document.createElement('div');
    div.innerHTML = escapedStr;
    var child = div.childNodes[0];
    return child ? child.nodeValue : '';
}

$(document).ready(function(){
	$.fn.vigoChat = function(myWidth) {
		var handle = null;
		var chatBox = $(this);
		var host = location.origin.replace(/^http/, 'ws')
		var conn = new WebSocket(host);
		chatBox.hide();

		var enterHandleInput = document.createElement('input');
		$(enterHandleInput).attr('type','text');

		var enterHandleDialog = document.createElement('div');	
		var activeUsersDisplay = document.createElement('div');

		function displayActiveUsers(){
			//Display active users
			$(activeUsersDisplay).addClass("vigochat_active_users_display");
			$(activeUsersDisplay).css({
				'position' : 'absolute',
				'left' : parseInt(chatBox.css('width')) + 20 + "px",
				'height' : parseInt(chatBox.css('height')) - 150 + "px",
				'top' : "20px"
			});
			chatBox.append(activeUsersDisplay);

			var userListRequest = {
				"type" : "user-list-request",
			}
			conn.send(JSON.stringify(userListRequest));
		}

		function setHandle(){
			//Send a request to set the handle
			var setHandleRequest = {
				"type" : "set-handle-request",
				"handle" : handle
			}
			conn.send(JSON.stringify(setHandleRequest));
		}
		conn.onopen = function(e) {
		    //console.log("Connected to chat server.");
		    $('body').append(enterHandleDialog);
			$(enterHandleDialog).dialog({
				width: "auto",
				height: "auto",
				modal: true,
				resizable: false,
				title: "Enter Chat Handle",
				buttons: {
					'Enter Chatroom' : function(){
						if($(enterHandleInput).val() != ""){
							handle = $(enterHandleInput).val();
							$(this).dialog('close');
							chatBox.fadeIn();
							setHandle();
							displayActiveUsers();
						}
					}
				}
			}).append(enterHandleInput);
		};
		function pingServer(){
			var herokuping = setInterval(function(){
				var herokuPing = {
					'type' : 'ping'
				}
				//console.log("Sending server ping");
				conn.send(JSON.stringify(herokuPing));
			},3000);
		}
		var checkConn = setInterval(function(){
			if(conn.readyState === 1){
				//Ping every 3 seconds to keep heroku from closing the connection
				clearInterval(checkConn);
				pingServer();
			}else{
				//console.log("Waiting for connection");
			}
		},5);

		conn.onerror = function(error){
			console.log(error);
			connected = false;
		}

		conn.onclose = function(){
			connected = false;
		}
		
    	$(this).addClass("vigochat_wrapper");
    	if(myWidth){
	    	this.css({
	    		'width' : myWidth
	    	});
	    }

		var message_display = document.createElement('div');
		$(message_display).addClass('vigochat_message_display');
		this.append(message_display);

		var message_input = document.createElement('textarea');
		this.append(message_input);
		$(message_input).addClass('vigochat_message_input');
		$(message_input).width(Number(parseInt(chatBox.css('width')) - (parseInt(chatBox.css('padding')) / 2) - 64) + "px");


		var message_send_button = document.createElement('input');
		$(message_send_button).attr('type','button');
		$(message_send_button).attr('value','Send');
		$(message_send_button).addClass('vigochat_message_send_button');
		this.append(message_send_button);

		$(this).draggable().bind('click', function(){
			$(message_input).focus();
			//$(this).css('z-index','1');
		});

		var private_message_windows = [];
		conn.onmessage = function(e) {
			var message = JSON.parse(e.data);
			//console.log(JSON.stringify(message));
		   	//If we receive a chat message
		    if(message.type == "message"){
			    var msg = document.createElement('div');
				$(msg).addClass('vigochat_incoming_message');
				$(msg).append("<b>" + message.from + "</b>" + ": " + message.message);
				$(message_display).append(msg);
				$(message_display).append("<br class='vigochat_message_break'/>");
				//Autoscroll the display
		    	$(message_display).animate({
		           scrollTop: $(message_display).get(0).scrollHeight
		        }, 300);
		    }
		    //If we receive a private message
		    if(message.type == "private-message"){
		    	if(checkForOpenPrivateMessageWindowForUser(message.from)){
		    		//Make sure it's displayed
		    		reopenHiddenMessageWindowForUser(message.from);
		    		//Show the message
			    	for(var index = 0;index < private_message_windows.length;index++){
			    		var privateMessageBox = private_message_windows[index];
			    		if($(privateMessageBox).attr('handle') == message.from){
			    			var disp = $(privateMessageBox).find('.vigochat_private_message_window_message_display');
			    			var msg = document.createElement('div');
							$(msg).addClass('vigochat_incoming_message');
							$(msg).append("<b>" + message.from + "</b>" + ": " + escapeHtml(message.message));
							$(disp).append(msg);
							$(disp).append("<br class='vigochat_message_break'/>");
							//Autoscroll the display
					    	$(disp).animate({
					           scrollTop: $(disp).get(0).scrollHeight
					        }, 300);
			    		}
			    	}
			    }else{
			    	openPrivateMessageWindow(message.from);
		    		setTimeout(function(){
		    			for(var index = 0;index < private_message_windows.length;index++){
			    			var privateMessageBox = private_message_windows[index];
				    		if($(privateMessageBox).attr('handle') == message.from){
				    			var disp = $(privateMessageBox).find('.vigochat_private_message_window_message_display');
				    			var msg = document.createElement('div');
								$(msg).addClass('vigochat_incoming_message');
								$(msg).append("<b>" + message.from + "</b>" + ": " + escapeHtml(message.message));
								$(disp).append(msg);
								$(disp).append("<br class='vigochat_message_break'/>");
								//Autoscroll the display
						    	$(disp).animate({
						           scrollTop: $(disp).get(0).scrollHeight
						        }, 300);
				    		}
				    	}
			    	},10);
		    	}
		    }
		    //If we receive a set handle request response
		    if(message.type == "set-handle-response"){
		    	var setHandleResponse = message.response;
		    	if(setHandleResponse == "handle-unavailable"){
		    		chatBox.hide();
		    		alert("The handle you entered is not available, please enter another.");
		    		$(enterHandleDialog).dialog("open");
		    	}
		    }
		    //If we receive a user list request response
		    if(message.type == "user-list-response"){
		    	$(activeUsersDisplay).html(''); //clear it and refill it.
		    	var users = message.userlist;
		    	for(var currentUser in users){
		    		if(users[currentUser] != handle){
						//var userDisplay = "<div handle='" + users[currentUser] + "' class='vigochat_connected_user'>" + users[currentUser] + "</div>";
		    			var userDisplay = document.createElement('div');
		    			$(userDisplay).attr('handle',users[currentUser]);
		    			$(userDisplay).addClass('vigochat_connected_user');
		    			$(userDisplay).append("👤 ");
		    			var displayName = users[currentUser];
		    			if(displayName.length > 9){
		    				displayName = displayName.substring(0,6) + "...";
		    			}
		    			$(userDisplay).append(displayName);
		    			$(activeUsersDisplay).append(userDisplay);
		    			$(userDisplay).click(function(){
							openPrivateMessageWindow($(this).attr('handle'));
						});
						
		    		}
		    	}
		    }
		    //If we receive a request to close all private message windows for a user
		    if(message.type == "user-disconnected"){
		    	var discoUser = message.handle;
		    	deleteOpenPrivateMessageWindowForUser(discoUser);
		    }
		};

		function checkForOpenPrivateMessageWindowForUser(user){
			for(var index = 0; index < private_message_windows.length; index++){
				var currentPMWindow = private_message_windows[index];
				if(currentPMWindow != null){
					if(currentPMWindow.attr('handle') == user){
						return true;
					}
				}
			}
			return false;
		}
		function deleteOpenPrivateMessageWindowForUser(user){
			for(var index = 0; index < private_message_windows.length; index++){
				var currentPMWindow = private_message_windows[index];
				if(currentPMWindow != null){
					if(currentPMWindow.attr('handle') == user){
						private_message_windows[index].remove();
						private_message_windows[index] = null;
						alert(user + " has disconnected from the chat.");
					}
				}
			}
			return false;
		}
		function removePrivateMessageWindowForUser(user){
			for(var index = 0; index < private_message_windows.length; index++){
				var currentPMWindow = private_message_windows[index];
				if(currentPMWindow != null){
					if(currentPMWindow.attr('handle') == user){
						private_message_windows[index] = null;
					}
				}
			}
		}

		function reopenHiddenMessageWindowForUser(user){
			for(var index = 0; index < private_message_windows.length; index++){
				var currentPMWindow = private_message_windows[index];
				if(currentPMWindow != null){
					if(currentPMWindow.attr('handle') == user){
						private_message_windows[index].fadeIn();
					}
				}
			}
		}

		var emojiCodes = "😀 😇 😎 😁 😐 😑 😕 😗 😙 😛 😟 😦 😧 😬 😮 😯 😴 😶 😂 😃 😄 😅 😆 😉 😊 😋 😌 😍 😏 😒 😓 😔 😖 😘 😚 😜 😝 😞 😠 😡 😢 😣 😤 😥 😨 😩 😪 😫 😭 😰 😱 😲 😳 😵 😷 🤓 🤪 🤮 😸 😹 😺 😻 😼 😽 😾 😿 🙀 🙅 🙆 🙇 🙈 🙉 🙊 🙋 🙌 🙍 🙎 🙏 ⌚ ⌛ ♻ 🍟 🍕 🍔 🍌 🍄 🍀 🌽 🌹 🍭 🍪 🍰 🍳 🍺 🍻 🎁 🎂 🎃 🎄 🎈 🎉 🎒 🎓 🎤 🎥 🎧 🎨 🎩 🎬 🎭 🎮 🎵 🎸 🎹 🎺 🎻 🏆 👀 👂 👃 👄 👅 👆 👇 👈 👉 👊 👋 👌 👍 👎 👏 👐 👑 👓 👔 👕 👖 👗 👘 👙 👚 👛 👜 👝 👞 👟 👠 👡 👢 👣 👤 👦 👧 👨 👩 👪 👫 👮 👯 👰 👱 👴 👵 👶 👷 👸 👹 👺 👻 👼 👽 👾 👿 💀 💁 💂 💃 💄 💅 💆 💇 💉 💊 💋 💌 💍 💎 💏 💑 💐 💒 💓 💔 💕 💖 💗 💘 💙 💚 💛 💜 💝 💞 💟 💠 💡 💢 💣 💤 💥 💦 💧 💨 💩 💪 💬 💯 💰 💲 💳 💵 💸 💻 💽 💾 💿 📀 📁 📂 📃 📅 📌 📎";
		function openPrivateMessageWindow(user_to_pm){
			if(user_to_pm != "⏳"){
				var already_open = checkForOpenPrivateMessageWindowForUser(user_to_pm);
				if(!already_open){
					//Create the PM window
					var pmWindow = document.createElement('div');
					$(pmWindow).attr("handle",user_to_pm);
					$(pmWindow).css("position","absolute");
					$(pmWindow).css("width","290px");
					$(pmWindow).css("height","305px");
					$(pmWindow).css("top", ($(window).height() / 2) - ($(pmWindow).height() / 2));
	    			$(pmWindow).css("left",($(window).width() / 2) - ($(pmWindow).width() / 2));
					$(pmWindow).addClass('vigochat_private_message_window');

					//The top bar holder
					var pmWindowTopBar = document.createElement('div');
					$(pmWindowTopBar).addClass("vigochat_private_message_window_top_bar");
					//The close button
					var pmWindowCloseButton = document.createElement('div');
					$(pmWindowCloseButton).addClass('vigochat_private_message_window_close_button');
					$(pmWindowCloseButton).append("X");
					$(pmWindowCloseButton).click(function(){
						$(pmWindowCloseButton).parent().parent().parent().fadeOut();
						//removePrivateMessageWindowForUser(user_to_pm);
					});

					//The title bar
					var pmWindowTitleBar = document.createElement('div');
					$(pmWindowTitleBar).addClass('vigochat_private_message_window_title_bar');
					$(pmWindowTitleBar).append("&nbsp;Private Message - " + user_to_pm);


					$(pmWindowTopBar).append(pmWindowTitleBar);
					$(pmWindowTitleBar).append(pmWindowCloseButton);

					//Append the top bar
					$(pmWindow).append(pmWindowTopBar);

					//The message display area
					var pmWindowMessageDisplay = document.createElement('div');
					$(pmWindowMessageDisplay).addClass('vigochat_private_message_window_message_display');
					$(pmWindow).append(pmWindowMessageDisplay);

					//The message input
					var pmWindowMessageInputWrapper = document.createElement('div');
					$(pmWindowMessageInputWrapper).addClass('vigochat_private_message_window_message_input_wrapper');
					var pmWindowMessageInput = document.createElement('textarea');
					$(pmWindowMessageInput).addClass('vigochat_private_message_window_message_input');
					$(pmWindowMessageInputWrapper).append(pmWindowMessageInput);
					$(pmWindow).append(pmWindowMessageInputWrapper);

					//createEmojiDisplay(pmWindow,pmWindowMessageInput);
					//Emoji Display
					var pmEmojiDisplay = document.createElement('div');
					$(pmEmojiDisplay).addClass('vigochat_private_message_window_emojis');
					$(pmEmojiDisplay).css('margin-top','5px');
					$(pmEmojiDisplay).css('width','90%');

					$(pmWindow).append(pmEmojiDisplay);
					//Populate the emoji display
					var emojiArray = emojiCodes.split(' ');
					var emojiObjects = [];
					for(var emojiIndex = 0;emojiIndex < emojiArray.length; emojiIndex++){
						//var emojiObject = "<div index='" + emojiIndex + "' class='vigochat_emoji_button' value='" + emojiArray[emojiIndex] + "'>" + emojiArray[emojiIndex] + "</div>";
						var emojiObject = document.createElement('div');
						$(emojiObject).addClass('vigochat_emoji_button');
						$(emojiObject).attr('value',emojiArray[emojiIndex]);
						$(emojiObject).text(emojiArray[emojiIndex]);
						//console.log(emojiIndex + ":" + emojiArray[emojiIndex]);
						emojiObjects.push(emojiObject);
						$(pmEmojiDisplay).append(emojiObject);
						$(emojiObject).click(function(){
							var cursorIndex = $(pmWindowMessageInput).get(0).selectionStart;
							var firstHalf = $(pmWindowMessageInput).val().substring(0,cursorIndex);
							var secondHalf = $(pmWindowMessageInput).val().substring(cursorIndex++,$(pmWindowMessageInput).val().length);
							var newValue = firstHalf + $(this).attr('value') + secondHalf.replace(/\s*$/,"");
							$(pmWindowMessageInput).val(newValue);
							$(pmWindowMessageInput).focus();
							$(pmWindowMessageInput).get(0).setSelectionRange($(pmWindowMessageInput).val().length,$(pmWindowMessageInput).val().length);
						});
					}

					//Create the emoji display button
					var emojiDisplayBtn = document.createElement('button');
					$(emojiDisplayBtn).append('😀');
					$(emojiDisplayBtn).css('position','relative');
					$(emojiDisplayBtn).css('left','5px');
					$(emojiDisplayBtn).css('top','5px');
					$(emojiDisplayBtn).hover(function(){
						$(this).css('cursor','pointer');
					});
					$(pmWindow).append(emojiDisplayBtn);
					$(emojiDisplayBtn).click(function(){
						var pmEmojiDisplayStatus = $(pmEmojiDisplay).css('display');
						if(pmEmojiDisplayStatus == "block"){
							//console.log("Hiding PM Emoji Display");
							$(pmEmojiDisplay).children().hide();
							$(pmEmojiDisplay).animate({
							 	width : "-=95px"
							},function(){
								$(pmEmojiDisplay).hide();
							});
							
						}
						if(pmEmojiDisplayStatus == "none"){
							//console.log("Showing PM Emoji Display");
							$(pmEmojiDisplay).fadeIn();
							$(pmEmojiDisplay).animate({
							 	width : "+=95px",
							 	height : "285px"
							}, function(){
								$(pmEmojiDisplay).children().fadeIn();
							});
						}
					});

					$(pmWindow).draggable().bind('click', function(){
						$(pmWindowMessageInput).focus();
						//$(pmWindow).css('z-index',$(chatBox).css('z-index') + 1);

					});

					//Enter key on input textbox event
					$(pmWindowMessageInput).on('keyup', function(e){
						var messageEmpty = ($(pmWindowMessageInput).val().trim().length === 0) ? true : false;
						if(e.keyCode === 13 && messageEmpty === false){
							var message = {
								'type' : 'message',
								'recipient' : $(pmWindow).attr('handle'),
								'handle': handle,
								'message': $(pmWindowMessageInput).val()
							};
							var msg = document.createElement('div');
							$(msg).hide();
							$(msg).addClass('vigochat_outgoing_message');
							$(msg).append("<b>" + message.handle + "</b>" + ": " + escapeHtml(message.message));
							$(pmWindowMessageDisplay).append(msg);
							$(msg).fadeIn();
							$(pmWindowMessageDisplay).append("<br class='vigochat_message_break'/>");
							$(pmWindowMessageInput).val('');
							conn.send(JSON.stringify(message));
							$(this).trigger('sendMessage',message);
							//Autoscroll the display
					    	$(pmWindowMessageDisplay).animate({
					           scrollTop: $(pmWindowMessageDisplay).get(0).scrollHeight
					        }, 300);
						}else if(messageEmpty === true){
							$(pmWindowMessageInput).focus();
							$(pmWindowMessageInput).get(0).setSelectionRange(0,0);
						}
					});

					//Hide it
					$(pmWindow).hide();
					//Append the window to the body
					$('body').append(pmWindow);
					$(pmWindow).draggable();
					//$(pmWindow).resizable();
					//Fade it in
					$(pmWindow).fadeIn();
					private_message_windows.push($(pmWindow));
				}else{
					reopenHiddenMessageWindowForUser(user_to_pm);
				}
			}
		}

		//Send click event
		$(message_send_button).click(function(){
			if($(message_input).val().length != 0){
				var message = {
					'type' : 'message',
					'recipient' : 'all',
					'handle': handle,
					'message': escapeHtml($(message_input).val())
				};
				var msg = document.createElement('div');
				$(msg).hide();
				$(msg).addClass('vigochat_outgoing_message');
				$(msg).append("<b>" + message.handle + "</b>" + ": " + message.message);
				$(msg).wrap('<div style="width: 100%;"></div>');
				$(message_display).append(msg);
				$(msg).fadeIn();
				$(message_display).append("<br class='vigochat_message_break'/>");
				$(message_input).val('');
				conn.send(JSON.stringify(message));
				$(this).trigger('sendMessage',message);
				//Autoscroll the display
		    	$(message_display).animate({
		           scrollTop: $(message_display).get(0).scrollHeight
		        }, 300);
		    }
		});

		//Enter key on input textbox event
		$(message_input).on('keyup', function(e){
			var messageEmpty = ($(message_input).val().trim().length === 0) ? true : false;
			if(e.keyCode === 13 && messageEmpty === false){
				var message = {
					'type' : 'message',
					'recipient' : 'all',
					'handle': handle,
					'message': escapeHtml($(message_input).val())
				};
				var msg = document.createElement('div');
				$(msg).hide();
				$(msg).addClass('vigochat_outgoing_message');
				$(msg).append("<b>" + message.handle + "</b>" + ": " + message.message);
				$(message_display).append(msg);
				$(msg).fadeIn();
				$(message_display).append("<br class='vigochat_message_break'/>");
				$(message_input).val('');
				conn.send(JSON.stringify(message));
				$(this).trigger('sendMessage',message);
				//Autoscroll the display
		    	$(message_display).animate({
		           scrollTop: $(message_display).get(0).scrollHeight
		        }, 300);
			}else if(messageEmpty === true){
				$(message_input).focus();
				$(message_input).get(0).setSelectionRange(0,0);
			}
		});

		//console.log(element);
		//console.log(display);
		//Create the emoji display
		var emojiDisplay = document.createElement('div');
		$(emojiDisplay).addClass('vigochat_emojis');
		$(this).append(emojiDisplay);
		//Populate the emoji display
		var emojiArray = emojiCodes.split(' ');
		var emojiObjects = [];
		for(var emojiIndex = 0;emojiIndex < emojiArray.length; emojiIndex++){
			var emojiObject = "<div index='" + emojiIndex + "' class='vigochat_emoji_button' value='" + emojiArray[emojiIndex] + "'>" + emojiArray[emojiIndex] + "</div>";
			//console.log(emojiIndex + ":" + emojiArray[emojiIndex]);
			emojiObjects.push(emojiObject);
			$(emojiDisplay).append(emojiObject);
		}

		$('.vigochat_emoji_button').click(function(){
			var cursorIndex = $(message_input).get(0).selectionStart;
			var firstHalf = $(message_input).val().substring(0,cursorIndex);
			var secondHalf = $(message_input).val().substring(cursorIndex++,$(message_input).val().length);
			var newValue = firstHalf + $(this).attr('value') + secondHalf.replace(/\s*$/,"");
			$(message_input).val(newValue);
			$(message_input).focus();
			$(message_input).get(0).setSelectionRange(cursorIndex + 1,cursorIndex + 1);
		});

		//Create the emoji display button
		var emojiDisplayBtn = document.createElement('button');
		$(emojiDisplayBtn).append('😀');
		$(emojiDisplayBtn).addClass("vigochat_show_emoji_button");
		$(this).append(emojiDisplayBtn);
		var animating_emoji_display = false;
		$(emojiDisplayBtn).click(function(){
			if(animating_emoji_display == false){
				if($(".vigochat_emojis").css("display") == "block"){
					animating_emoji_display = true;
					$(emojiDisplay).animate({
						height : "-=100px"
					},function(){
						$(this).fadeOut();
						animating_emoji_display = false;
					});
				}
				else if($(".vigochat_emojis").css("display") == "none"){
					animating_emoji_display = true;
					$(emojiDisplay).fadeIn(100,function(){
						$(this).animate({
							height : "+=100px"
						},function(){
							animating_emoji_display = false;
						});
					});
				}	
			}		
		});
	


		//Hide userlist button
		var userListButton = document.createElement('button');
		$(userListButton).addClass("vigochat_user_list_button");
		$(userListButton).append("👥");
		

		var animating_user_list = false;
		$(userListButton).click(function(){
			if(animating_user_list == false){
				if( $(activeUsersDisplay).css('display') == "block" ){
					animating_user_list = true;
					if($(activeUsersDisplay).children().length > 0){
						$(activeUsersDisplay).children().fadeOut(10,function(){
							$(activeUsersDisplay).animate({
								width : '-=150px'
							}, function(){
								$(activeUsersDisplay).fadeOut();
								animating_user_list = false;
							});
						});
					}else{
						$(activeUsersDisplay).animate({
							width : '-=150px'
						}, function(){
							$(activeUsersDisplay).fadeOut();
							animating_user_list = false;
						});
					}
				}else{
					animating_user_list = true;
					$(activeUsersDisplay).fadeIn();
					$(activeUsersDisplay).animate({
						width : '+=150px'
					},300, function(){
						$(activeUsersDisplay).children().fadeIn();
						animating_user_list = false;
					});
				}	
			}		
		});
		$(this).append(userListButton);
		//Focus on the message input 
		$(message_input).focus();
	}
});