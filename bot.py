import discord
from discord.ext import commands
import json
import requests # New import for making HTTP requests to the local server

# --- CONFIGURATION ---

# Replace with your actual channel IDs
NEW_ORDERS_CHANNEL_ID = 1427383939487498322
COMPLETED_ORDERS_CHANNEL_ID = 1427383982374518854
CANCELED_ORDERS_CHANNEL_ID = 1427384010807447645

# Your bot's token. Keep this secret!
BOT_TOKEN = "MTQyNzM4MjI5Njc1ODk4MDczMA.GXrtS9.SDzzGz3NE1-z3elkKaJk3AKuAJZpAIQMAVB_XU"

# DELIMITER: Must match the one in script.js exactly
RAW_DATA_DELIMITER = "---ORDER_DATA_JSON---"

# LOCAL PRINTER SERVER URL
# This is the address of the Flask server you are running on your local machine
PRINTER_SERVER_URL = "http://127.0.0.1:5000/print"

# --- CORE BOT SETUP ---
intents = discord.Intents.default()
intents.message_content = True  
intents.messages = True
intents.guilds = True

bot = commands.Bot(command_prefix='!', intents=intents)

# --- UTILITY FUNCTION FOR PRINTING ---

def send_print_request(raw_data_json_string):
    """Parses the JSON string and sends a POST request to the local printer server."""
    
    # FIX: Check if the string is valid (not None or empty string) before proceeding
    if not raw_data_json_string or not isinstance(raw_data_json_string, str):
        return False, "Data Error: Order data not found or is invalid (None/empty)."

    try:
        # Parse the JSON string into a Python dict
        order_data = json.loads(raw_data_json_string)
        
        # Send POST request to the Flask server
        response = requests.post(PRINTER_SERVER_URL, json=order_data)
        
        # Check if the local server responded successfully
        if response.status_code == 200:
            return True, "Print job sent successfully to the local server."
        else:
            return False, f"Local server error ({response.status_code}): {response.text}"
            
    except requests.exceptions.ConnectionError:
        return False, f"Connection Error: The local server is not running or unreachable at {PRINTER_SERVER_URL}."
    except json.JSONDecodeError:
        return False, "Data Error: Could not parse order JSON data."
    except Exception as e:
        return False, f"An unexpected error occurred during print request: {e}"


# --- VIEWS (BUTTON COMPONENTS) ---

# This class defines the simplified view for CANCELED and COMPLETED orders
class SimplePrintView(discord.ui.View):
    def __init__(self, raw_order_data_json, status):
        super().__init__(timeout=None)
        self.raw_order_data_json = raw_order_data_json
        self.status = status 

    # Print Button (in Canceled/Completed channels)
    @discord.ui.button(label='Reprint', style=discord.ButtonStyle.secondary, emoji='🖨️', custom_id='reprint_button')
    async def reprint_order(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)

        success, message = send_print_request(self.raw_order_data_json)
        
        # Log status to the console
        print(f"REPRINT REQUEST STATUS ({self.status}): {message}")

        if success:
            await interaction.followup.send(f"✅ Reprint job sent! Status: {self.status} Order.", ephemeral=True)
        else:
            await interaction.followup.send(f"❌ Reprint Failed! Check the local server console. Error: {message}", ephemeral=True)


# This is the class that defines the buttons for NEW orders
class NewOrderView(discord.ui.View):
    def __init__(self, raw_order_data_json):
        super().__init__(timeout=None)
        self.raw_order_data_json = raw_order_data_json
        
    # Helper to retrieve the target channels
    def get_target_channels(self, guild):
        completed_channel = guild.get_channel(COMPLETED_ORDERS_CHANNEL_ID)
        canceled_channel = guild.get_channel(CANCELED_ORDERS_CHANNEL_ID)
        return completed_channel, canceled_channel

    # Complete Button
    @discord.ui.button(label='Complete', style=discord.ButtonStyle.green, emoji='✅', custom_id='complete_button')
    async def complete(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()

        message = interaction.message
        completed_channel, _ = self.get_target_channels(message.guild)
        
        # 1. Prepare the new simplified View (only Reprint button)
        view_to_send = SimplePrintView(self.raw_order_data_json, 'Completed')

        # 2. Get original embed and modify for status change
        embeds = message.embeds
        if embeds:
            embeds[0].color = discord.Color.green()
            embeds[0].title = "✅ Order Receipt (COMPLETE)"
        
        # 3. Post the new message and disable buttons on the old message (best practice)
        if completed_channel:
            await completed_channel.send(
                content=f"**ORDER COMPLETE - Handled by {interaction.user.display_name}**",
                embeds=embeds,
                view=view_to_send
            )
            # Disable buttons on the original message after action is taken
            for item in self.children:
                item.disabled = True
            await message.edit(view=self) # Update the original message view to show disabled buttons
            
            print(f"Order {message.id} marked COMPLETE and moved to #{completed_channel.name}")
        
        await interaction.followup.send(f"Order completed and moved to #{completed_channel.name}", ephemeral=True)


    # Cancel Button
    @discord.ui.button(label='Cancel', style=discord.ButtonStyle.red, emoji='❌', custom_id='cancel_button')
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()

        message = interaction.message
        _, canceled_channel = self.get_target_channels(message.guild)

        # 1. Prepare the new simplified View (only Reprint button)
        view_to_send = SimplePrintView(self.raw_order_data_json, 'Canceled')

        # 2. Get original embed and modify for status change
        embeds = message.embeds
        if embeds:
            embeds[0].color = discord.Color.red()
            embeds[0].title = "❌ Order Receipt (CANCELED)"

        # 3. Post the new message and disable buttons on the old message
        if canceled_channel:
            await canceled_channel.send(
                content=f"**ORDER CANCELED - Handled by {interaction.user.display_name}**",
                embeds=embeds,
                view=view_to_send
            )
            # Disable buttons on the original message after action is taken
            for item in self.children:
                item.disabled = True
            await message.edit(view=self) # Update the original message view to show disabled buttons

            print(f"Order {message.id} marked CANCELED and moved to #{canceled_channel.name}")

        await interaction.followup.send(f"Order canceled and moved to #{canceled_channel.name}", ephemeral=True)

    # Print Button (in the New Orders channel)
    @discord.ui.button(label='Print', style=discord.ButtonStyle.primary, emoji='🖨️', custom_id='print_button')
    async def print_order(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)

        success, message = send_print_request(self.raw_order_data_json)
        
        # Log status to the console
        print(f"NEW ORDER PRINT REQUEST STATUS: {message}")

        if success:
            await interaction.followup.send(f"✅ Print job sent successfully!", ephemeral=True)
        else:
            await interaction.followup.send(f"❌ Print Failed! Check the local server console. Error: {message}", ephemeral=True)


# --- BOT EVENT LISTENERS ---

@bot.event
async def on_ready():
    """Confirms the bot is logged in and ready."""
    print(f'Logged in as {bot.user.name} ({bot.user.id})')
    print('Bot is ready to start printing.')
    print(f"Local Print Server Target: {PRINTER_SERVER_URL}")
    print('-------------------------------')
    
    # We must register all our Views so they work if the bot restarts and messages with buttons exist.
    # This keeps the bot listening for button clicks on pre-existing messages.
    bot.add_view(NewOrderView(None))
    bot.add_view(SimplePrintView(None, ''))


@bot.event
async def on_message(message):
    """Listens for new webhook messages in the new orders channel."""
    if message.author == bot.user:
        return

    # 1. Check if the message is from a webhook and is in the new orders channel
    if message.webhook_id and message.channel.id == NEW_ORDERS_CHANNEL_ID:
        print(f"New order received in #{message.channel.name}")
        
        # 2. Extract the raw data JSON string from the message.content
        raw_data_string_start = message.content.find(RAW_DATA_DELIMITER)
        
        if raw_data_string_start != -1:
            try:
                # Extract the JSON string after the delimiter
                raw_data_json_string = message.content[raw_data_string_start + len(RAW_DATA_DELIMITER):]
                
                # New message content will just be a clean header
                new_content = "**NEW ORDER RECEIVED!**" 
                new_embeds = message.embeds
                
                # 3. Send the new message (owned by the bot) with the buttons
                new_message = await message.channel.send(
                    content=new_content,
                    embeds=new_embeds,
                    view=NewOrderView(raw_data_json_string) # Pass the JSON string to the view
                )
                
                # 4. Delete the original webhook message
                await message.delete()
                
                print(f"Webhook message deleted. New interactive message posted: {new_message.id}")
                
            except json.JSONDecodeError:
                print("Error: Could not decode JSON string from message content. Check website payload.")
            except discord.Forbidden:
                print("Error: Bot has permissions to delete/send, but something else failed. Check Channel Overrides.")
            except Exception as e:
                print(f"An unexpected error occurred during message repost: {e}")
        else:
            print("Error: Could not find raw order data delimiter in message content. Check website payload.")


    await bot.process_commands(message)

# Run the bot with your token
bot.run(BOT_TOKEN)
